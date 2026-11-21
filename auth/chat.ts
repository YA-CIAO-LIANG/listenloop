import { usageWeek } from "@/lib/usage-report";
import { getAdminSupabase } from "./admin";

/**
 * Chat practice sessions (D197), written by the server only: one row
 * per chat, the chosen minutes counted at the start, the unused part
 * given back at the end.
 */
export type ChatSession = {
  id: string;
  minutes: number;
  used_minutes: number | null;
  messages: number;
  started_at: string;
  ended_at: string | null;
};

/** Minutes counted this week (Monday 00:00 Taiwan time). */
export async function chatMinutesThisWeek(userId: string): Promise<number> {
  const admin = getAdminSupabase();
  if (!admin) return 0;
  const { data } = await admin
    .from("writing_chat_sessions")
    .select("minutes, used_minutes")
    .eq("user_id", userId)
    .gte("started_at", usageWeek(new Date()).start);
  return (data ?? []).reduce(
    (sum, row) => sum + (row.used_minutes ?? row.minutes),
    0,
  );
}

export async function startChatSession(
  userId: string,
  minutes: number,
): Promise<string | null> {
  const admin = getAdminSupabase();
  if (!admin) return null;
  const { data, error } = await admin
    .from("writing_chat_sessions")
    .insert({ user_id: userId, minutes })
    .select("id")
    .single();
  return error ? null : data.id;
}

export async function getChatSession(
  userId: string,
  id: string,
): Promise<ChatSession | null> {
  const admin = getAdminSupabase();
  if (!admin) return null;
  const { data } = await admin
    .from("writing_chat_sessions")
    .select("id, minutes, used_minutes, messages, started_at, ended_at")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  return data;
}

export async function countChatMessage(session: ChatSession) {
  const admin = getAdminSupabase();
  await admin
    ?.from("writing_chat_sessions")
    .update({ messages: session.messages + 1 })
    .eq("id", session.id);
}

export async function endChatSession(session: ChatSession, used: number) {
  const admin = getAdminSupabase();
  await admin
    ?.from("writing_chat_sessions")
    .update({
      used_minutes: Math.max(0, Math.min(session.minutes, used)),
      ended_at: new Date().toISOString(),
    })
    .eq("id", session.id)
    .is("ended_at", null);
}
