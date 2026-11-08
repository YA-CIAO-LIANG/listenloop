"use server";

import { getAdminSupabase } from "@/auth/admin";
import { getServerSupabase } from "@/auth/server";
import { getSignedInUser } from "@/auth/session";
import { recordIntent } from "@/app/intent-actions";
import { isIntentSource } from "@/lib/intent";
import { isBillingPeriod, isPaidPlan } from "@/lib/payments/pricing";

export type WaitlistResult =
  { ok: true } | { ok: false; reason: "unavailable" | "failed" };

/**
 * Adds the signed-in account to the paid plan's waiting list (D72), with
 * the user's own session (row level security: their own row only).
 * Joining twice is the same as joining once.
 */
export async function joinWaitlist(
  /** The plan and period they chose, and where they came from (D102). */
  choice: { plan?: unknown; period?: unknown; source?: unknown } = {},
): Promise<WaitlistResult> {
  const [user, supabase] = await Promise.all([
    getSignedInUser(),
    getServerSupabase(),
  ]);
  if (!user || !supabase) return { ok: false, reason: "unavailable" };
  const plan = isPaidPlan(choice.plan) ? choice.plan : null;
  const period = isBillingPeriod(choice.period) ? choice.period : null;
  const source = isIntentSource(choice.source) ? choice.source : null;
  // The latest choice wins: written with the secret key (people may only
  // insert their own row, not change it).
  const admin = getAdminSupabase();
  const { error } = admin
    ? await admin
        .from("waitlist")
        .upsert(
          { user_id: user.id, plan, billing_period: period, source },
          { onConflict: "user_id" },
        )
    : await supabase
        .from("waitlist")
        .upsert(
          { user_id: user.id },
          { onConflict: "user_id", ignoreDuplicates: true },
        );
  if (error) return { ok: false, reason: "failed" };
  await recordIntent({
    step: "waitlist_join",
    ...(plan ? { plan } : {}),
    ...(period ? { interval: period } : {}),
    ...(source ? { source } : {}),
  });
  return { ok: true };
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
