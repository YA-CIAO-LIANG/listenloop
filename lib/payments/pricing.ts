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
