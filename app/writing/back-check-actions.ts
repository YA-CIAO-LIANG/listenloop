"use server";

import { getAdminSupabase } from "@/auth/admin";
import { creatorMeter } from "@/auth/creator";
import { plansFor } from "@/auth/quota";
import { allowAction } from "@/auth/rate-limit";
import { getSignedInUser } from "@/auth/session";
import { featurePaused } from "@/auth/site-switches";
import { backChecksThisWeek } from "@/auth/writing";
import { backCheckBudget } from "@/lib/ai/budgets";
import { meteredLanguage } from "@/lib/ai/metered";
import { getAiProviders } from "@/lib/ai/providers";
import { can, planFor } from "@/lib/plans";
import { cleanBackCheck } from "@/lib/writing/back-check/clean";
import {
  BACK_CHECK_MAX_CHARS,
  BACK_CHECK_MAX_ITEMS,
  type BackCheckItem,
  type BackJudgement,
} from "@/lib/writing/back-check/types";
import { DICTATION_MODES } from "@/lib/writing/settings";

export type BackCheckResult =
  | {
      ok: true;
      /** Each judged answer by its place in the set. */
      judgements: { i: number; judgement: BackJudgement }[];
      /** Checks left this week; null: no limit. */
      left: number | null;
    }
  | {
      ok: false;
      /**
       * Why there's no AI check; the rules' results stand (D200):
       * "plan": this week's checks are used; "limit": today's AI cost
       * limit; the others as for the essay review.
       */
      reason:
        | "signIn"
        | "invalid"
        | "paused"
        | "suspended"
        | "plan"
        | "limit"
        | "busy"
        | "unavailable"
        | "failed";
      max?: number;
    };

const clip = (value: unknown) =>
  typeof value === "string" ? value.trim().slice(0, BACK_CHECK_MAX_CHARS) : "";

/**
 * Extra practice's answers the rules didn't find exactly right, judged
 * by the AI in one call (D200): signed in, within the plan's checks a
 * week and the daily AI cost limits like every AI call. Whatever stops
 * it, the practice goes on with the rules' results.
 */
export async function checkExtraAnswers(input: {
  items: BackCheckItem[];
}): Promise<BackCheckResult> {
  const user = await getSignedInUser();
  if (!user) return { ok: false, reason: "signIn" };
  const raw = Array.isArray(input?.items) ? input.items : [];
  const items: BackCheckItem[] = raw
    .slice(0, BACK_CHECK_MAX_ITEMS)
    .flatMap((item) => {
      const mode = DICTATION_MODES.find((m) => m === item?.mode);
      const reference = clip(item?.reference);
      const answer = clip(item?.answer);
      if (!mode || !reference || !answer || !Number.isInteger(item?.i))
        return [];
      return [
        { i: item.i, mode, reference, meaning: clip(item.meaning), answer },
      ];
    });
  if (items.length === 0) return { ok: false, reason: "invalid" };
  if (await featurePaused(user, "aiGenerate")) {
    return { ok: false, reason: "paused" };
  }
  if (user.aiSuspended != null && user.role !== "admin") {
    return { ok: false, reason: "suspended" };
  }
  const plan = planFor(user);
  const plans = await plansFor(user);
  const used = await backChecksThisWeek(user.id);
  const weekly = can(plan, { kind: "back-check", thisWeek: used }, plans);
  if (!weekly.ok) return { ok: false, reason: "plan", max: weekly.max };
  if (!(await allowAction("ai", user.id))) {
    return { ok: false, reason: "busy" };
  }
  const providers = getAiProviders();
  const admin = getAdminSupabase();
  const check = providers?.language.checkBack;
  if (!providers || !admin || !check) {
    return { ok: false, reason: "unavailable" };
  }
  const request = { items };
  const result = await meteredLanguage(
    { providers, meter: await creatorMeter(admin, user, "manual") },
    backCheckBudget(request),
    () => check.call(providers.language, request),
    // A note that said the opposite of its verdict is dropped (the
    // verdict stands) and counted in the usage log (D205).
    (value) => {
      let inconsistent = 0;
      cleanBackCheck(value, request, () => (inconsistent += 1));
      return inconsistent
        ? `back-check · inconsistent ${inconsistent}`
        : "back-check";
    },
  );
  if (!result.ok) {
    if (result.reason === "limit") return { ok: false, reason: "limit" };
    return { ok: false, reason: result.reason === "busy" ? "busy" : "failed" };
  }
  const judged = cleanBackCheck(result.value, request);
  if (judged.size === 0) return { ok: false, reason: "failed" };
  const max = plans[plan].backChecksPerWeek;
  return {
    ok: true,
    judgements: [...judged].map(([i, judgement]) => ({ i, judgement })),
    left: max === null ? null : Math.max(0, max - used - 1),
  };
}
