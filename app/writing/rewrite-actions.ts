"use server";

import { randomUUID } from "node:crypto";
import { getAdminSupabase } from "@/auth/admin";
import { creatorMeter } from "@/auth/creator";
import { plansFor } from "@/auth/quota";
import { allowAction } from "@/auth/rate-limit";
import { getSignedInUser } from "@/auth/session";
import { featurePaused } from "@/auth/site-switches";
import { getWritingPrompt } from "@/data/writing";
import { rewriteBudget } from "@/lib/ai/budgets";
import { meteredLanguage } from "@/lib/ai/metered";
import { getAiProviders } from "@/lib/ai/providers";
import { can, planFor, type PlanBlock } from "@/lib/plans";
import type { UsageBlock } from "@/lib/usage";
import {
  CUSTOM_KINDS,
  customTask,
  isCustomPromptId,
  MAX_CUSTOM_TASK,
} from "@/lib/writing/custom";
import { cleanRewrite, essaySentences } from "@/lib/writing/rewrite/clean";
import {
  isRewriteLevel,
  REWRITE_ADJUSTS,
  type RewriteVersion,
} from "@/lib/writing/rewrite/types";
import type { WritingLevel } from "@/lib/writing/types";
import { countWords } from "@/lib/writing/words";

export type RewriteResult =
  | { ok: true; version: RewriteVersion }
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
        | "declined"
        | "failed";
      block?: PlanBlock;
      limit?: UsageBlock;
    };

/**
 * Day 1's essay rewritten in correct English (D218), for Days 2–6 to
 * practice: at a level ("fix", "natural", "advanced"), or a step easier
 * or harder than the version shown. Signed in only, within the plan's
 * essay length and the daily and monthly AI cost limits like every AI
 * call (meteredLanguage: "counted in the allowance"). The essay goes to
 * the model as data and isn't stored on the server; the browser keeps the
 * versions with Day 1 (and the account's own documents).
 */
export async function rewriteEssay(input: {
  promptId: string;
  essay: string;
  level: string;
  adjust?: string;
  /** With adjust: the version shown, by sentence. */
  current?: { i: number; en: string }[];
  custom?: { kind: string; task: string };
}): Promise<RewriteResult> {
  const user = await getSignedInUser();
  if (!user) return { ok: false, reason: "signIn" };
  const essay = typeof input?.essay === "string" ? input.essay.trim() : "";
  const prompt = promptFor(input);
  const level = input?.level;
  const adjust = REWRITE_ADJUSTS.find((a) => a === input?.adjust);
  const sentences = essaySentences(essay);
  if (!prompt || !essay || !isRewriteLevel(level) || sentences.length === 0) {
    return { ok: false, reason: "invalid" };
  }
  const current = adjust
    ? (Array.isArray(input.current) ? input.current : [])
        .filter(
          (s) =>
            Number.isInteger(s?.i) &&
            typeof s?.en === "string" &&
            sentences.some((x) => x.i === s.i),
        )
        .map((s) => ({ i: s.i, en: s.en.trim().slice(0, 800) }))
    : undefined;
  if (adjust && !current?.length) return { ok: false, reason: "invalid" };
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
  if (!(await allowAction("ai", user.id))) {
    return { ok: false, reason: "busy" };
  }
  const providers = getAiProviders();
  const admin = getAdminSupabase();
  const rewrite = providers?.language.rewriteEssay;
  if (!providers || !admin || !rewrite) {
    return { ok: false, reason: "unavailable" };
  }
  const own = sentences.map(({ i, en }) => ({ i, en }));
  // Adjusting: the version shown is what's rewritten; the learner's own
  // sentences come along for their meaning.
  const request = {
    level,
    ...(adjust ? { adjust } : {}),
    learner: prompt.level,
    task: prompt.task,
    sentences: adjust && current ? current : own,
    ...(adjust ? { original: own } : {}),
  };
  const paragraphs = new Map(sentences.map((s) => [s.i, s.p]));
  const result = await meteredLanguage(
    { providers, meter: await creatorMeter(admin, user, "manual") },
    rewriteBudget(request),
    () => rewrite.call(providers.language, request),
    (value) => {
      const cleaned = cleanRewrite(value, { sentences: own }, paragraphs);
      return cleaned.ok
        ? `rewrite:${adjust ?? level}${cleaned.missing.length ? ` · missing ${cleaned.missing.length}` : ""}`
        : `rewrite:${cleaned.declined ?? "unusable"}`;
    },
  );
  if (!result.ok) {
    if (result.reason === "limit") {
      return { ok: false, reason: "limit", limit: result.limit };
    }
    return { ok: false, reason: result.reason === "busy" ? "busy" : "failed" };
  }
  const cleaned = cleanRewrite(result.value, { sentences: own }, paragraphs);
  if (!cleaned.ok) {
    return { ok: false, reason: cleaned.declined ? "declined" : "failed" };
  }
  return {
    ok: true,
    version: {
      id: randomUUID(),
      level,
      ...(adjust ? { adjust } : {}),
      sentences: cleaned.sentences,
      grade: cleaned.grade,
      at: new Date().toISOString(),
    },
  };
}

/** The task and level to rewrite for: an official prompt's, or the learner's own. */
function promptFor(input: {
  promptId?: unknown;
  custom?: { kind?: unknown; task?: unknown };
}): { task: string; level: WritingLevel } | undefined {
  if (typeof input?.promptId !== "string") return undefined;
  if (!isCustomPromptId(input.promptId)) {
    const prompt = getWritingPrompt(input.promptId);
    return prompt && { task: prompt.task, level: prompt.level };
  }
  const kind = CUSTOM_KINDS.find((k) => k === input.custom?.kind);
  if (!kind) return undefined;
  const task =
    kind === "custom"
      ? typeof input.custom?.task === "string"
        ? input.custom.task.trim().slice(0, MAX_CUSTOM_TASK)
        : ""
      : customTask({ kind, task: "" });
  return task ? { task, level: "intermediate" } : undefined;
}
