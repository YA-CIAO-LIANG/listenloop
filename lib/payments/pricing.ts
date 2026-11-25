import { isPlanTier, PLAN_TIERS, type PlanLine, type PlanTier } from "../plans";

/**
 * The paid plans' prices (D85, D210), in one place: the pricing page,
 * checkout, and the fake provider all read them. Amounts are in the
 * currency's smallest unit (NT$ has none, so NT$149 is 149). What each
 * plan includes is in lib/plans.ts; changing a price means editing this
 * only, and only after Joe decides (D210).
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

// --- Plans and pricing (D102, D105, D210): three lines, three tiers. ---

/**
 * The paid tiers on the pricing page, in every line (D210). "plus" is the
 * account plan "paid" on the "all" line.
 */
export const PAID_PLANS = PLAN_TIERS;
export type PaidPlan = PlanTier;

export const isPaidPlan = (value: unknown): value is PaidPlan =>
  isPlanTier(value);

/**
 * Billing periods: a month, or a year paid ahead (D105: no two-year
 * period). A year still resets the monthly allowances each month.
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
 * Monthly prices in NT$ by line and tier (D210, Joe 2026-11-24: final; any
 * change is Joe's to make first). The yearly ones follow (D105). What
 * each includes is in lib/plans.ts.
 */
export const PLAN_MONTHLY: Readonly<
  Record<PlanLine, Readonly<Record<PaidPlan, number>>>
> = {
  listening: { student: 90, plus: 149, pro: 299 },
  writing: { student: 119, plus: 149, pro: 249 },
  all: { student: 189, plus: 269, pro: 499 },
};

type LinePrices = Readonly<
  Record<PaidPlan, Readonly<Record<BillingPeriod, Price>>>
>;

/** Every plan's year is 10 × its month (D105, D173). */
export const PLAN_PRICES: Readonly<Record<PlanLine, LinePrices>> = {
  listening: linePrices(PLAN_MONTHLY.listening),
  writing: linePrices(PLAN_MONTHLY.writing),
  all: linePrices(PLAN_MONTHLY.all),
};

function linePrices(monthly: Readonly<Record<PaidPlan, number>>): LinePrices {
  return {
    student: monthlyAndYearly(monthly.student),
    plus: monthlyAndYearly(monthly.plus),
    pro: monthlyAndYearly(monthly.pro),
  };
}

/**
 * What checkout and the fake provider charge: the account plan "paid",
 * Plus on the "all" line (D85, D210). Paying isn't open yet.
 */
export const PRICES = PLAN_PRICES.all.plus;

/**
 * Whole months a year saves against paying monthly: 2 under the
 * ten-months rule (D105).
 */
export function monthsSaved(plan: PaidPlan, line: PlanLine = "all"): number {
  const { month, year } = PLAN_PRICES[line][plan];
  return Math.floor((month.amount * 12 - year.amount) / month.amount);
}

/** The line and period selected when the pricing page opens (D210). */
export const DEFAULT_LINE: PlanLine = "all";
export const DEFAULT_PERIOD: BillingPeriod = "year";

/** The plan marked "most popular" on the pricing page (D210). */
export const POPULAR_PLAN: { line: PlanLine; tier: PaidPlan } = {
  line: "all",
  tier: "plus",
};

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
  line: PlanLine = "all",
): number {
  const paid = PLAN_PRICES[line][plan][period].amount;
  if (daysSincePayment <= REFUND_DAYS) return paid;
  const unused = Math.max(0, PERIOD_MONTHS[period] - Math.ceil(monthsUsed));
  return Math.min(paid, Math.round((paid / PERIOD_MONTHS[period]) * unused));
}
