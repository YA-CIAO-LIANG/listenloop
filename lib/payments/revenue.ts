import type { BillingInterval } from "./pricing";
import type { SubscriptionStatus } from "./types";

/**
 * The admin revenue overview's numbers (D85), from the stored
 * subscriptions and payments. Amounts are summed per currency's smallest
 * unit; every price is in NT$ for now (lib/payments/pricing.ts).
 */
export type RevenueSubscription = {
  status: SubscriptionStatus;
  interval: BillingInterval;
  cancelAtPeriodEnd: boolean;
  test: boolean;
};

export type RevenuePayment = {
  amount: number;
  status: "paid" | "refunded";
  createdAt: string;
  refundedAt: string | null;
  test: boolean;
};

export type RevenueSummary = {
  /** Active or past due: still on the paid plan. */
  subscribers: number;
  /** Of those, how many won't renew. */
  cancelling: number;
  /** Monthly recurring revenue: a yearly plan counts a twelfth. */
  monthlyRecurring: number;
  /** Paid this month, less what was refunded this month. */
  netThisMonth: number;
  refundsThisMonth: number;
  /** Some of it came from the fake provider: show "test". */
  test: boolean;
};

export function revenueSummary(
  subscriptions: readonly RevenueSubscription[],
  payments: readonly RevenuePayment[],
  prices: Record<BillingInterval, { amount: number }>,
  monthStart: string,
): RevenueSummary {
  const live = subscriptions.filter((s) => s.status !== "expired");
  const since = Date.parse(monthStart);
  const inMonth = (iso: string | null) =>
    iso !== null && Date.parse(iso) >= since;
  const paid = payments.filter((p) => inMonth(p.createdAt));
  const refunded = payments.filter(
    (p) => p.status === "refunded" && inMonth(p.refundedAt),
  );
  return {
    subscribers: live.length,
    cancelling: live.filter((s) => s.cancelAtPeriodEnd).length,
    monthlyRecurring: Math.round(
      live
        .filter((s) => !s.cancelAtPeriodEnd)
        .reduce(
          (sum, s) =>
            sum +
            (s.interval === "month"
              ? prices.month.amount
              : prices.year.amount / 12),
          0,
        ),
    ),
    netThisMonth:
      paid.reduce((sum, p) => sum + p.amount, 0) -
      refunded.reduce((sum, p) => sum + p.amount, 0),
    refundsThisMonth: refunded.length,
    test: subscriptions.some((s) => s.test) || payments.some((p) => p.test),
  };
}
