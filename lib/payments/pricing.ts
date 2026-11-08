/**
 * The paid plan's prices (D85), in one place: the pricing page, checkout,
 * and the fake provider all read them. Amounts are in the currency's
 * smallest unit (NT$ has none, so NT$149 is 149). What the plan includes
 * is PLANS.paid (lib/plans.ts); changing a price means editing this only.
 */
export const BILLING_INTERVALS = ["month", "year"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export const isBillingInterval = (value: unknown): value is BillingInterval =>
  (BILLING_INTERVALS as readonly unknown[]).includes(value);

export type Price = { amount: number; currency: string };

export const PRICES: Readonly<Record<BillingInterval, Price>> = {
  month: { amount: 149, currency: "TWD" },
  // Two months free: 10 × the monthly price.
  year: { amount: 1490, currency: "TWD" },
};

/** Days of free trial before the first charge (none for now). */
export const TRIAL_DAYS = 0;

/** Full refunds are given within this many days of a payment. */
export const REFUND_DAYS = 7;

/** The yearly price per month, for "NT$124 / month, billed yearly". */
export const yearlyPerMonth = () => Math.round(PRICES.year.amount / 12);

/** How much a year saves against paying monthly, in whole percent. */
export const yearlySaving = () =>
  Math.round((1 - PRICES.year.amount / (PRICES.month.amount * 12)) * 100);

/**
 * A stored amount for people to read: "NT$1,490" for NT$ (which has no
 * smaller unit), else the locale's currency format of amount / 100.
 */
export function formatPrice(
  amount: number,
  currency: string,
  /** The locale's number format, as a currency when one is given. */
  formatNumber: (value: number, currency?: string) => string,
): string {
  return currency === "TWD"
    ? `NT$${formatNumber(amount)}`
    : formatNumber(amount / 100, currency);
}

// --- Plans and pricing (D102): Plus and Pro, three billing periods. -----

/** The paid plans on the pricing page. "plus" is the account plan "paid". */
export const PAID_PLANS = ["plus", "pro"] as const;
export type PaidPlan = (typeof PAID_PLANS)[number];

export const isPaidPlan = (value: unknown): value is PaidPlan =>
  (PAID_PLANS as readonly unknown[]).includes(value);

/**
 * Billing periods: a month, a year, or two years paid ahead. Longer
 * periods still reset the monthly minutes each month; they don't pile up.
 */
export const BILLING_PERIODS = ["month", "year", "twoYear"] as const;
export type BillingPeriod = (typeof BILLING_PERIODS)[number];

export const isBillingPeriod = (value: unknown): value is BillingPeriod =>
  (BILLING_PERIODS as readonly unknown[]).includes(value);

export const PERIOD_MONTHS: Readonly<Record<BillingPeriod, number>> = {
  month: 1,
  year: 12,
  twoYear: 24,
};

/** Joe's prices (D102), in NT$. */
export const PLAN_PRICES: Readonly<
  Record<PaidPlan, Readonly<Record<BillingPeriod, Price>>>
> = {
  plus: {
    month: { amount: 149, currency: "TWD" },
    year: { amount: 1290, currency: "TWD" },
    twoYear: { amount: 2290, currency: "TWD" },
  },
  pro: {
    month: { amount: 299, currency: "TWD" },
    year: { amount: 2590, currency: "TWD" },
    twoYear: { amount: 4590, currency: "TWD" },
  },
};

/** Shown first, and marked "most popular". */
export const DEFAULT_PERIOD: BillingPeriod = "year";
/** Marked "best value". */
export const BEST_VALUE_PERIOD: BillingPeriod = "twoYear";
/**
 * Offered on the website only: Google Play's auto-renewing subscriptions
 * go up to a year (D102), so the Android app doesn't show these.
 */
export const WEB_ONLY_PERIODS: readonly BillingPeriod[] = ["twoYear"];

/** The price per month for a period, rounded to whole NT$. */
export function pricePerMonth(plan: PaidPlan, period: BillingPeriod): number {
  return Math.round(PLAN_PRICES[plan][period].amount / PERIOD_MONTHS[period]);
}

/** What a period saves against paying monthly for as long. */
export function periodSaving(
  plan: PaidPlan,
  period: BillingPeriod,
): { amount: number; percent: number } {
  const monthly = PLAN_PRICES[plan].month.amount * PERIOD_MONTHS[period];
  const amount = monthly - PLAN_PRICES[plan][period].amount;
  return { amount, percent: Math.round((amount / monthly) * 100) };
}

/**
 * Refund for a prepaid period cancelled early (D102): within REFUND_DAYS
 * of paying, all of it; after that, the unused whole months at the
 * period's own monthly rate (the discount stays fair both ways).
 */
export function prepaidRefund(
  plan: PaidPlan,
  period: BillingPeriod,
  daysSincePayment: number,
  monthsUsed: number,
): number {
  const paid = PLAN_PRICES[plan][period].amount;
  if (daysSincePayment <= REFUND_DAYS) return paid;
  const unused = Math.max(0, PERIOD_MONTHS[period] - Math.ceil(monthsUsed));
  return Math.min(paid, Math.round((paid / PERIOD_MONTHS[period]) * unused));
}
