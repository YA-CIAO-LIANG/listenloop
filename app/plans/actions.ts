"use server";

import { getServerSupabase } from "@/auth/server";
import { getSignedInUser } from "@/auth/session";

export type WaitlistResult =
  { ok: true } | { ok: false; reason: "unavailable" | "failed" };

/**
 * Adds the signed-in account to the paid plan's waiting list (D72), with
 * the user's own session (row level security: their own row only).
 * Joining twice is the same as joining once.
 */
export async function joinWaitlist(): Promise<WaitlistResult> {
  const [user, supabase] = await Promise.all([
    getSignedInUser(),
    getServerSupabase(),
  ]);
  if (!user || !supabase) return { ok: false, reason: "unavailable" };
  const { error } = await supabase
    .from("waitlist")
    .upsert(
      { user_id: user.id },
      { onConflict: "user_id", ignoreDuplicates: true },
    );
  return error ? { ok: false, reason: "failed" } : { ok: true };
}

/** Whether the signed-in account is on the waiting list. */
export async function onWaitlist(): Promise<boolean> {
  const [user, supabase] = await Promise.all([
    getSignedInUser(),
    getServerSupabase(),
  ]);
  if (!user || !supabase) return false;
  const { data } = await supabase
    .from("waitlist")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  return data !== null;
}
