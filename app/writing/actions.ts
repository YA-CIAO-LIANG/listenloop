"use server";

import { getAdminSupabase } from "@/auth/admin";
import { creatorMeter } from "@/auth/creator";
import { plansFor } from "@/auth/quota";
import { allowAction } from "@/auth/rate-limit";
import { getSignedInUser } from "@/auth/session";
import { featurePaused } from "@/auth/site-switches";
import { writingReviewsThisWeek } from "@/auth/writing";
import { getWritingPrompt } from "@/data/writing";
import { writingBudget } from "@/lib/ai/budgets";
import { meteredLanguage } from "@/lib/ai/metered";
import { getAiProviders } from "@/lib/ai/providers";
import { can, planFor, type PlanBlock } from "@/lib/plans";
import type { UsageBlock } from "@/lib/usage";
import { cleanFeedback, type WritingFeedback } from "@/lib/writing/feedback";
import { countWords } from "@/lib/writing/words";
import { WRITING_TYPE_CONFIG } from "@/lib/writing/types";

export type ReviewResult =
  | { ok: true; feedback: WritingFeedback; left: number | null }
  | {
      ok: false;
      reason:
        | "signIn"
        | "invalid"
        | "paused"
        | "suspended"
        | "plan"
        | "limit"
        | "busy"
        | "unavailable"
        | "filtered"
        | "failed";
      /** With "plan": which allowance (weekly reviews or essay length). */
      block?: PlanBlock;
      /** With "limit": the daily or monthly AI allowance (D77). */
      limit?: UsageBlock;
    };

/**
 * AI feedback on a Day 1 or Day 7 essay (WritingLoop, D187). Signed in
 * only (guests score themselves against the rubric), within the plan's
 * weekly reviews and essay length, and the daily and monthly AI cost
 * limits like every other AI call (meteredLanguage). The essay is sent to
 * the model as data and is not stored on the server: the browser keeps it
 * (and copies it to the account's own documents).
 */
export async function reviewEssay(input: {
  promptId: string;
  day: number;
  essay: string;
}): Promise<ReviewResult> {
  const user = await getSignedInUser();
  if (!user) return { ok: false, reason: "signIn" };
  const prompt =
    typeof input?.promptId === "string"
      ? getWritingPrompt(input.promptId)
      : undefined;
  const essay = typeof input?.essay === "string" ? input.essay.trim() : "";
  if (!prompt || (input.day !== 1 && input.day !== 7) || !essay) {
    return { ok: false, reason: "invalid" };
  }
  if (await featurePaused(user, "aiGenerate")) {
    return { ok: false, reason: "paused" };
  }
  if (user.aiSuspended != null && user.role !== "admin") {
    return { ok: false, reason: "suspended" };
  }
  const plan = planFor(user);
  const plans = await plansFor(user);
  const length = can(
    plan,
    { kind: "writing-words", words: countWords(essay) },
    plans,
  );
  if (!length.ok) return { ok: false, reason: "plan", block: length };
  const used = await writingReviewsThisWeek(user.id);
  const weekly = can(plan, { kind: "writing-review", thisWeek: used }, plans);
  if (!weekly.ok) return { ok: false, reason: "plan", block: weekly };
  if (!(await allowAction("ai", user.id))) {
    return { ok: false, reason: "busy" };
  }
  const providers = getAiProviders();
  const admin = getAdminSupabase();
  const review = providers?.language.reviewWriting;
  if (!providers || !admin || !review) {
    return { ok: false, reason: "unavailable" };
  }
  const rubric = WRITING_TYPE_CONFIG[prompt.type].rubric;
  const request = {
    type: prompt.type,
    rubric,
    task: prompt.task,
    words: prompt.words,
    essay,
  };
  const result = await meteredLanguage(
    { providers, meter: await creatorMeter(admin, user, "manual") },
    writingBudget(request),
    () => review.call(providers.language, request),
    (value) => {
      const declined = (value as { declined?: unknown })?.declined;
      return typeof declined === "string" ? declined : "unknown";
    },
  );
  if (!result.ok) {
    if (result.reason === "limit") {
      return { ok: false, reason: "limit", limit: result.limit };
    }
    // The provider's safety filter refused the essay, e.g. text that
    // reads as instructions to the AI (D188).
    if (result.filtered) return { ok: false, reason: "filtered" };
    return {
      ok: false,
      reason: result.reason === "busy" ? "busy" : "failed",
    };
  }
  const feedback = cleanFeedback(result.value, essay, rubric);
  if (!feedback) return { ok: false, reason: "failed" };
  const max = plans[plan].writingReviewsPerWeek;
  return {
    ok: true,
    feedback,
    left: max === null ? null : Math.max(0, max - used - 1),
  };
}
