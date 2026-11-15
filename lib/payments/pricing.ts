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

/**
 * Every yearly price is the monthly price × this (D105): a year costs ten
 * months, two months free. Yearly prices are never written by hand.
 */
export const YEARLY_MONTHS_CHARGED = 10;
/** The months a year saves: 12 − YEARLY_MONTHS_CHARGED. */
export const YEARLY_MONTHS_FREE = 12 - YEARLY_MONTHS_CHARGED;

/** A yearly price from its monthly price. */
export const yearlyFromMonthly = (monthly: number): number =>
  monthly * YEARLY_MONTHS_CHARGED;

/** "Averages NT$X a month": a yearly price ÷ 12, rounded. */
export const averagePerMonth = (yearly: number): number =>
  Math.round(yearly / 12);

/** Prices as monthly + yearly, the yearly one derived. */
const monthlyAndYearly = (
  monthly: number,
  currency = "TWD",
): Readonly<Record<BillingInterval, Price>> => ({
  month: { amount: monthly, currency },
  year: { amount: yearlyFromMonthly(monthly), currency },
});

/** Plus, as checkout and the fake provider charge it (D85). */
export const PRICES = monthlyAndYearly(149);

/** Days of free trial before the first charge (none for now). */
export const TRIAL_DAYS = 0;

/** Full refunds are given within this many days of a payment. */
export const REFUND_DAYS = 7;

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

// --- Plans and pricing (D102, D105): Plus and Pro, monthly or yearly. ----

/**
 * The paid plans on the pricing page. "plus" is the account plan "paid";
 * "student" is Plus at a student price (D144).
 */
export const PAID_PLANS = ["plus", "pro", "student"] as const;
export type PaidPlan = (typeof PAID_PLANS)[number];

export const isPaidPlan = (value: unknown): value is PaidPlan =>
  (PAID_PLANS as readonly unknown[]).includes(value);

/**
 * Billing periods: a month, or a year paid ahead (D105: no two-year
 * period). A year still resets the monthly minutes each month.
 */
export const BILLING_PERIODS = BILLING_INTERVALS;
export type BillingPeriod = (typeof BILLING_PERIODS)[number];

export const isBillingPeriod = (value: unknown): value is BillingPeriod =>
  (BILLING_PERIODS as readonly unknown[]).includes(value);

export const PERIOD_MONTHS: Readonly<Record<BillingPeriod, number>> = {
  month: 1,
  year: 12,
};

/**
 * Monthly prices in NT$ (D102, D173; Pro and student raised by D185 so a
 * subscriber who uses every minute still earns the price floor,
 * lib/payments/price-floor.ts); the yearly ones follow (D105). The most
 * popular plan is marked on the pricing page.
 */
export const PLAN_MONTHLY: Readonly<Record<PaidPlan, number>> = {
  plus: PRICES.month.amount,
  pro: 319,
  student: 119,
};

/**
 * Every plan's year is 10 × its month (D105); the student plan's earlier
 * exception (NT$990, D144) was dropped by Joe on 2026-11-14 (D173).
 */
export const PLAN_PRICES: Readonly<
  Record<PaidPlan, Readonly<Record<BillingPeriod, Price>>>
> = {
  plus: monthlyAndYearly(PLAN_MONTHLY.plus),
  pro: monthlyAndYearly(PLAN_MONTHLY.pro),
  student: monthlyAndYearly(PLAN_MONTHLY.student),
};

/**
 * Whole months a year saves against paying monthly: 2 under the
 * ten-months rule (D105).
 */
export function monthsSaved(plan: PaidPlan): number {
  const { month, year } = PLAN_PRICES[plan];
  return Math.floor((month.amount * 12 - year.amount) / month.amount);
}

/** The period selected when the pricing page opens (D173). */
export const DEFAULT_PERIOD: BillingPeriod = "year";

/** The plan marked "most popular" on the pricing page (D173). */
export const POPULAR_PLAN: PaidPlan = "plus";

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
