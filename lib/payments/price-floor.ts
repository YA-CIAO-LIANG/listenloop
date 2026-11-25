import { CLASS_TIERS, classPrice } from "../classroom";
import { ECPAY_FEE_RATE, TW_BUSINESS_TAX } from "../forecast";
import { PLAN_LINES, PLAN_TIERS, type PlanLine, type PlanTier } from "../plans";
import {
  allowanceCost,
  classAllowance,
  planAllowance,
  type MonthlyAllowance,
} from "./costs";
import {
  BILLING_PERIODS,
  PERIOD_MONTHS,
  PLAN_PRICES,
  yearlyFromMonthly,
  type BillingPeriod,
} from "./pricing";

/**
 * The price floor (D185, Joe 2026-11-15): even if every subscriber uses
 * every allowance of their plan, each one must still earn this much a
 * month after the 5% business tax, ECPay's fee, and the AI and voice
 * cost (lib/payments/costs.ts, D210). NT$15 a subscriber pays the
 * servers (NT$1,500 a month) from 100 subscribers. A second guard beside
 * the cost caps (D210); checked in tests/price-floor.test.ts.
 */
export const PRICE_FLOOR = {
  /** NT$ a subscriber a month, in the worst case. */
  minMarginPerMonth: 15,
} as const;

/** What's ours of a payment: without the tax inside it, less the fee. */
const kept = (paid: number) =>
  paid / (1 + TW_BUSINESS_TAX) - paid * ECPAY_FEE_RATE;

/**
 * NT$ a month left from one subscriber who pays `paid` for `period` and
 * uses all of `allowance` every month (the worst case).
 */
export function worstCaseMargin(
  paid: number,
  period: BillingPeriod,
  allowance: MonthlyAllowance,
): number {
  return kept(paid) / PERIOD_MONTHS[period] - allowanceCost(allowance);
}

/**
 * The lowest whole monthly price for `allowance` that keeps both periods
 * at or above the floor (a year is 10 months, D105, so the year decides).
 */
export function minimumMonthly(allowance: MonthlyAllowance): number {
  let monthly = 1;
  while (
    !BILLING_PERIODS.every(
      (period) =>
        worstCaseMargin(
          period === "year" ? yearlyFromMonthly(monthly) : monthly,
          period,
          allowance,
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
  margin: number;
}[] {
  const personal = PLAN_LINES.flatMap((line: PlanLine) =>
    PLAN_TIERS.flatMap((tier: PlanTier) =>
      BILLING_PERIODS.map((period) => {
        const paid = PLAN_PRICES[line][tier][period].amount;
        return {
          plan: `${line}-${tier}`,
          period,
          paid,
          margin: worstCaseMargin(paid, period, planAllowance(line, tier)),
        };
      }),
    ),
  );
  const classes = CLASS_TIERS.flatMap((tier) =>
    PLAN_LINES.flatMap((line) =>
      BILLING_PERIODS.map((period) => {
        const paid = classPrice(tier, period, line);
        return {
          plan: `class-${tier.id}-${line}`,
          period,
          paid,
          margin: worstCaseMargin(paid, period, classAllowance(tier, line)),
        };
      }),
    ),
  );
  return [...personal, ...classes];
}
