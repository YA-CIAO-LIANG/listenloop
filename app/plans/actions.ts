"use server";

import { getAdminSupabase } from "@/auth/admin";
import { getPriceView } from "@/auth/prices";
import { getServerSupabase } from "@/auth/server";
import { getSignedInUser } from "@/auth/session";
import { recordIntent } from "@/app/intent-actions";
import { isIntentSource } from "@/lib/intent";
import { isBillingPeriod, isPaidPlan } from "@/lib/payments/pricing";
import { EXPERIMENT_LINE } from "@/lib/price-experiments";
import { isPlanLine } from "@/lib/plans";

export type WaitlistResult =
  { ok: true } | { ok: false; reason: "unavailable" | "failed" };

/**
 * Adds the signed-in account to the paid plans' waiting list (D72), with
 * the line, tier, and period they chose (D210). Joining twice is the same
 * as joining once; the latest choice wins.
 */
export async function joinWaitlist(
  /** The line, tier, and period they chose, and where from (D102, D210). */
  choice: {
    line?: unknown;
    plan?: unknown;
    period?: unknown;
    source?: unknown;
  } = {},
): Promise<WaitlistResult> {
  const [user, supabase] = await Promise.all([
    getSignedInUser(),
    getServerSupabase(),
  ]);
  if (!user || !supabase) return { ok: false, reason: "unavailable" };
  const plan = isPaidPlan(choice.plan) ? choice.plan : null;
  // Before lines (D210) every plan was what's now the "all" line.
  const line = plan ? (isPlanLine(choice.line) ? choice.line : "all") : null;
  const period = isBillingPeriod(choice.period) ? choice.period : null;
  const source = isIntentSource(choice.source) ? choice.source : null;
  // The price they saw, for the early-bird offer when paying opens (D174).
  const view = plan ? await getPriceView(`u:${user.id}`) : null;
  const seen =
    plan && line && view ? view.prices[line][plan][period ?? "month"] : null;
  const fromExperiment =
    view?.experiment &&
    view.experiment.plan === plan &&
    line === EXPERIMENT_LINE
      ? view.experiment
      : null;
  // The latest choice wins: written with the secret key (people may only
  // insert their own row, not change it).
  const admin = getAdminSupabase();
  const { error } = admin
    ? await admin.from("waitlist").upsert(
        {
          user_id: user.id,
          plan,
          plan_line: line,
          billing_period: period,
          source,
          seen_amount: seen?.amount ?? null,
          seen_currency: seen?.currency ?? null,
          seen_experiment_id: fromExperiment?.id ?? null,
          seen_variant: fromExperiment?.variant ?? null,
        },
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
    // "all-plus", "listening-student"… (D210)
    ...(plan && line ? { plan: `${line}-${plan}` } : {}),
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
