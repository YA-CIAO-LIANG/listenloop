import { CLASS_TIERS, classCostPerMinute, classPrice } from "../classroom";
import { ECPAY_FEE_RATE, TW_BUSINESS_TAX } from "../forecast";
import { PLANS } from "../plans";
import {
  BILLING_PERIODS,
  PERIOD_MONTHS,
  PLAN_PRICES,
  yearlyFromMonthly,
  type BillingPeriod,
  type PaidPlan,
} from "./pricing";

/**
 * The price floor (D185, Joe 2026-11-15): even if every subscriber uses
 * every minute of their plan, each one must still earn this much a month
 * after the 5% business tax, ECPay's fee, and the AI and voice cost of
 * those minutes. NT$15 a subscriber pays the servers (NT$1,500 a month)
 * from 100 subscribers. Checked for every plan and period in
 * tests/price-floor.test.ts, and for price experiments' variants.
 */
export const PRICE_FLOOR = {
  /** NT$ a subscriber a month, in the worst case. */
  minMarginPerMonth: 15,
} as const;

/** Minutes of practice a month each paid plan may make (lib/plans.ts). */
export const PLAN_MINUTES: Readonly<Record<PaidPlan, number>> = {
  plus: PLANS.paid.minutesPerMonth ?? 0,
  // The student plan is Plus at a student price (D144).
  student: PLANS.paid.minutesPerMonth ?? 0,
  pro: PLANS.pro.minutesPerMonth ?? 0,
};

/** What's ours of a payment: without the tax inside it, less the fee. */
const kept = (paid: number) =>
  paid / (1 + TW_BUSINESS_TAX) - paid * ECPAY_FEE_RATE;

/**
 * NT$ a month left from one subscriber who pays `paid` for `period` and
 * uses all `minutes` every month (the worst case).
 */
export function worstCaseMargin(
  paid: number,
  period: BillingPeriod,
  minutes: number,
): number {
  return kept(paid) / PERIOD_MONTHS[period] - minutes * classCostPerMinute();
}

/**
 * The lowest whole monthly price for a plan with `minutes` that keeps both
 * periods at or above the floor (a year is 10 months, D105, so the year
 * decides).
 */
export function minimumMonthly(minutes: number): number {
  let monthly = 1;
  while (
    !BILLING_PERIODS.every(
      (period) =>
        worstCaseMargin(
          period === "year" ? yearlyFromMonthly(monthly) : monthly,
          period,
          minutes,
        ) >= PRICE_FLOOR.minMarginPerMonth,
    )
  ) {
    monthly += 1;
  }
  return monthly;
}

/** Every plan and period, personal and class, with its worst-case margin. */
export function worstCaseTable(): {
  plan: string;
  period: BillingPeriod;
  paid: number;
  minutes: number;
  margin: number;
}[] {
  const personal = (Object.keys(PLAN_MINUTES) as PaidPlan[]).flatMap((plan) =>
    BILLING_PERIODS.map((period) => {
      const paid = PLAN_PRICES[plan][period].amount;
      const minutes = PLAN_MINUTES[plan];
      return {
        plan,
        period,
        paid,
        minutes,
        margin: worstCaseMargin(paid, period, minutes),
      };
    }),
  );
  const classes = CLASS_TIERS.flatMap((tier) =>
    BILLING_PERIODS.map((period) => {
      const paid = classPrice(tier, period);
      return {
        plan: `class-${tier.id}`,
        period,
        paid,
        minutes: tier.minutes,
        margin: worstCaseMargin(paid, period, tier.minutes),
      };
    }),
  );
  return [...personal, ...classes];
}
