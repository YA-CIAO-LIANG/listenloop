"use server";

import { getTranslations } from "next-intl/server";
import { getAdminSupabase } from "@/auth/admin";
import {
  chatMessagesThisWeek,
  countChatMessage,
  endChatSession,
  getChatSession,
  startChatSession,
} from "@/auth/chat";
import { creatorMeter } from "@/auth/creator";
import { plansFor } from "@/auth/quota";
import { allowAction } from "@/auth/rate-limit";
import { getSignedInUser } from "@/auth/session";
import { featurePaused } from "@/auth/site-switches";
import { chatBudget } from "@/lib/ai/budgets";
import { meteredLanguage } from "@/lib/ai/metered";
import { getAiProviders } from "@/lib/ai/providers";
import { can, planFor, type PlanBlock } from "@/lib/plans";
import type { UsageBlock } from "@/lib/usage";
import { cleanChatTurn } from "@/lib/writing/chat/clean";
import {
  GRACE_SECONDS,
  HISTORY_TURNS,
  MAX_MESSAGE,
  MAX_SITUATION,
  maxMessages,
  usedMinutes,
} from "@/lib/writing/chat/limits";
import { selfHarmSignal } from "@/lib/writing/chat/safety";
import {
  CHAT_LENGTHS,
  CHAT_LEVELS,
  CHAT_SCENARIOS,
  type ChatTurn,
  type ChatTurnInput,
} from "@/lib/writing/chat/types";

type Refusal =
  | "signIn"
  | "invalid"
  | "paused"
  | "suspended"
  | "plan"
  | "busy"
  | "unavailable";

export type StartChatResult =
  | {
      ok: true;
      sessionId: string;
      startedAt: string;
      /** Messages left this week; null: no limit (D209). */
      left: number | null;
    }
  | { ok: false; reason: Refusal; block?: PlanBlock };

/**
 * Starts a chat (D197): signed in, with at least one of the plan's weekly
 * messages left (D209: each message sent counts; the chosen length only
 * bounds this chat). The conversation itself never reaches the database.
 */
export async function startChat(input: {
  minutes: number;
}): Promise<StartChatResult> {
  const user = await getSignedInUser();
  if (!user) return { ok: false, reason: "signIn" };
  const minutes = CHAT_LENGTHS.find((m) => m === input?.minutes);
  if (!minutes) return { ok: false, reason: "invalid" };
  if (await featurePaused(user, "aiGenerate")) {
    return { ok: false, reason: "paused" };
  }
  if (user.aiSuspended != null && user.role !== "admin") {
    return { ok: false, reason: "suspended" };
  }
  const providers = getAiProviders();
  if (!providers?.language.chatTurn) {
    return { ok: false, reason: "unavailable" };
  }
  const plan = planFor(user);
  const plans = await plansFor(user);
  const used = await chatMessagesThisWeek(user.id);
  const allowed = can(plan, { kind: "chat-message", thisWeek: used }, plans);
  if (!allowed.ok) return { ok: false, reason: "plan", block: allowed };
  if (!(await allowAction("ai", user.id))) {
    return { ok: false, reason: "busy" };
  }
  const sessionId = await startChatSession(user.id, minutes);
  if (!sessionId) return { ok: false, reason: "unavailable" };
  const max = plans[plan].chatMessagesPerWeek;
  return {
    ok: true,
    sessionId,
    startedAt: new Date().toISOString(),
    left: max === null ? null : Math.max(0, max - used),
  };
}

export type ChatReplyResult =
  | { ok: true; turn: ChatTurn }
  | {
      ok: false;
      reason: Refusal | "ended" | "tooMany" | "limit" | "filtered" | "failed";
      limit?: UsageBlock;
      /** For "plan": the weekly messages are used up (D209). */
      block?: PlanBlock;
    };

const clip = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

/** Learners in a class with a guardian's consent are under 18 (D197). */
async function inMinorClass(userId: string): Promise<boolean> {
  const admin = getAdminSupabase();
  if (!admin) return false;
  const { count } = await admin
    .from("class_members")
    .select("user_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("minor_consent", true);
  return (count ?? 0) > 0;
}

/**
 * One message and the partner's answer (D197): a reply and a quiet
 * correction in one AI call, within the session's time and message
 * count, and the daily AI cost limits like every AI call. A message that
 * suggests self-harm never reaches the AI: the practice stops and help is
 * offered (lib/writing/chat/safety.ts).
 */
export async function sendChat(input: {
  sessionId: string;
  scenario: string;
  custom?: string;
  level: string;
  teen?: boolean;
  history: { from: string; text: string }[];
  message: string;
}): Promise<ChatReplyResult> {
  const user = await getSignedInUser();
  if (!user) return { ok: false, reason: "signIn" };
  const scenario = CHAT_SCENARIOS.find((s) => s === input?.scenario);
  const level = CHAT_LEVELS.find((l) => l === input?.level);
  const message = clip(input?.message, MAX_MESSAGE);
  if (!scenario || !level || !message || typeof input.sessionId !== "string") {
    return { ok: false, reason: "invalid" };
  }
  const session = await getChatSession(user.id, input.sessionId);
  if (!session) return { ok: false, reason: "invalid" };
  const deadline =
    Date.parse(session.started_at) +
    (session.minutes * 60 + GRACE_SECONDS) * 1000;
  if (session.ended_at || Date.now() > deadline) {
    return { ok: false, reason: "ended" };
  }
  if (session.messages >= maxMessages(session.minutes)) {
    return { ok: false, reason: "tooMany" };
  }
  if (selfHarmSignal(message)) {
    await endChatSession(session, usedMinutes(session.started_at));
    const t = await getTranslations("writingChat");
    return {
      ok: true,
      turn: {
        safety: "self-harm",
        reply: t("safety.reply"),
        correction: null,
        phrase: null,
        glossary: [],
      },
    };
  }
  if (await featurePaused(user, "aiGenerate")) {
    return { ok: false, reason: "paused" };
  }
  if (user.aiSuspended != null && user.role !== "admin") {
    return { ok: false, reason: "suspended" };
  }
  // Each message counts against the week's (D209).
  const allowed = can(
    planFor(user),
    { kind: "chat-message", thisWeek: await chatMessagesThisWeek(user.id) },
    await plansFor(user),
  );
  if (!allowed.ok) return { ok: false, reason: "plan", block: allowed };
  if (!(await allowAction("ai", user.id))) {
    return { ok: false, reason: "busy" };
  }
  const providers = getAiProviders();
  const admin = getAdminSupabase();
  const chat = providers?.language.chatTurn;
  if (!providers || !admin || !chat) {
    return { ok: false, reason: "unavailable" };
  }
  const history = (Array.isArray(input.history) ? input.history : [])
    .slice(-HISTORY_TURNS)
    .map((m) => ({
      from: m?.from === "me" ? ("me" as const) : ("them" as const),
      text: clip(m?.text, MAX_MESSAGE),
    }))
    .filter((m) => m.text);
  const request: ChatTurnInput = {
    scenario,
    ...(scenario === "custom"
      ? { custom: clip(input.custom, MAX_SITUATION) }
      : {}),
    level,
    teen: input.teen === true || (await inMinorClass(user.id)),
    history,
    message,
  };
  const result = await meteredLanguage(
    { providers, meter: await creatorMeter(admin, user, "manual") },
    chatBudget(request),
    () => chat.call(providers.language, request),
    (value) => {
      const safety = (value as { safety?: unknown })?.safety;
      return typeof safety === "string" ? safety : "unknown";
    },
  );
  if (!result.ok) {
    if (result.reason === "limit") {
      return { ok: false, reason: "limit", limit: result.limit };
    }
    if (result.filtered) return { ok: false, reason: "filtered" };
    return { ok: false, reason: result.reason === "busy" ? "busy" : "failed" };
  }
  const turn = cleanChatTurn(result.value, message);
  if (!turn) return { ok: false, reason: "failed" };
  await countChatMessage(session);
  if (turn.safety === "self-harm") {
    await endChatSession(session, usedMinutes(session.started_at));
  }
  return { ok: true, turn };
}

/** Ends a chat (D197); its messages stay counted (D209). */
export async function endChat(input: { sessionId: string }): Promise<void> {
  const user = await getSignedInUser();
  if (!user || typeof input?.sessionId !== "string") return;
  const session = await getChatSession(user.id, input.sessionId);
  if (!session || session.ended_at) return;
  await endChatSession(session, usedMinutes(session.started_at));
}

/**
 * Reports one of the partner's replies (D197): only that reply and the
 * situation go to the admins' feedback list, never the learner's own
 * messages.
 */
export async function reportChatReply(input: {
  scenario: string;
  reply: string;
  reason: string;
}): Promise<{ ok: boolean }> {
  const user = await getSignedInUser();
  if (!user) return { ok: false };
  const reply = clip(input?.reply, 600);
  const scenario = CHAT_SCENARIOS.find((s) => s === input?.scenario);
  if (!reply || !scenario) return { ok: false };
  if (!(await allowAction("report", user.id))) return { ok: false };
  const admin = getAdminSupabase();
  if (!admin) return { ok: false };
  const { error } = await admin.from("feedback").insert({
    user_id: user.id,
    category: "content",
    page: "/writing/chat",
    message: `[chat report] scenario: ${scenario}; reason: ${clip(input.reason, 300) || "-"}; reply: ${reply}`,
  });
  return { ok: !error };
}
