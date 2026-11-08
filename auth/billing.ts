import { getServerSupabase } from "./server";
import type { BillingInterval } from "@/lib/payments/pricing";
import type { SubscriptionStatus } from "@/lib/payments/types";

export type Subscription = {
  subscriptionId: string;
  status: SubscriptionStatus;
  interval: BillingInterval;
  periodEnd: string;
  cancelAtPeriodEnd: boolean;
  test: boolean;
};

export type Payment = {
  id: string;
  amount: number;
  currency: string;
  status: "paid" | "refunded";
  interval: BillingInterval | null;
  createdAt: string;
  test: boolean;
};

/**
 * The signed-in account's subscription and payments (D85), with their own
 * session: row level security returns only their rows.
 */
export async function getOwnBilling(userId: string): Promise<{
  subscription: Subscription | null;
  payments: Payment[];
}> {
  const supabase = await getServerSupabase();
  if (!supabase) return { subscription: null, payments: [] };
  const [{ data: sub }, { data: rows }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select(
        "provider_subscription_id, status, billing_interval, current_period_end, cancel_at_period_end, test",
      )
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("payments")
      .select(
        "id, amount, currency, status, billing_interval, created_at, test",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  return {
    subscription: sub
      ? {
          subscriptionId: sub.provider_subscription_id,
          status: sub.status as SubscriptionStatus,
          interval: sub.billing_interval as BillingInterval,
          periodEnd: sub.current_period_end,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          test: sub.test,
        }
      : null,
    payments: (rows ?? []).map((row) => ({
      id: row.id,
      amount: row.amount,
      currency: row.currency,
      status: row.status as Payment["status"],
      interval: row.billing_interval as BillingInterval | null,
      createdAt: row.created_at,
      test: row.test,
    })),
  };
}
