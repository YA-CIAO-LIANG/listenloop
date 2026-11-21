import {
  CLASS_COST,
  CLASS_TIERS,
  classCostPerMinute,
  classPrice,
} from "../classroom";
import { ECPAY_FEE_RATE, TW_BUSINESS_TAX } from "../forecast";
import { PLANS } from "../plans";
import { MESSAGES_PER_MINUTE } from "../writing/chat/limits";
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

/**
 * WritingLoop's AI essay reviews (D187): about 1,800 tokens in (the
 * instructions, the task, an essay of up to 600 words) and 1,600 out
 * (scores with reasons, up to eight issues, strengths, summary) on
 * gpt-5-mini (US$0.25 / US$2.00 a million), so about US$0.0037, NT$0.12.
 * Re-measure with the writing eval's recorded usage when the prompt
 * changes (evals/writing-report.md).
 */
export const WRITING_REVIEW_COST = {
  inputTokens: 1_800,
  outputTokens: 1_600,
  usdPerMillionIn: 0.25,
  usdPerMillionOut: 2.0,
} as const;

/** NT$ one essay review costs (D187). */
export function writingReviewCost(): number {
  const c = WRITING_REVIEW_COST;
  const usd =
    (c.inputTokens * c.usdPerMillionIn + c.outputTokens * c.usdPerMillionOut) /
    1_000_000;
  return usd * CLASS_COST.twdPerUsd;
}

/** Weeks in a month, for weekly allowances. */
export const WEEKS_PER_MONTH = 52 / 12;

/** Essay reviews a week each paid plan may use (lib/plans.ts). */
export const PLAN_WRITING_REVIEWS: Readonly<Record<PaidPlan, number>> = {
  plus: PLANS.paid.writingReviewsPerWeek ?? 0,
  student: PLANS.paid.writingReviewsPerWeek ?? 0,
  pro: PLANS.pro.writingReviewsPerWeek ?? 0,
};

/** NT$ a month of every weekly review used (the worst case). */
export const writingMonthCost = (perWeek: number) =>
  perWeek * WEEKS_PER_MONTH * writingReviewCost();

/**
 * One chat turn (D197), measured on the chat eval's recording (32 turns,
 * 748 tokens in and 178 out on average on gpt-5-mini), with room for a
 * longer conversation (the last 10 messages go with each turn): 1,050 in
 * and 250 out, about US$0.00076, NT$0.024.
 */
export const CHAT_TURN_COST = {
  inputTokens: 1_050,
  outputTokens: 250,
  usdPerMillionIn: 0.25,
  usdPerMillionOut: 2.0,
} as const;

/** NT$ one chat minute costs at most: MESSAGES_PER_MINUTE turns. */
export function chatMinuteCost(): number {
  const c = CHAT_TURN_COST;
  const usd =
    (c.inputTokens * c.usdPerMillionIn + c.outputTokens * c.usdPerMillionOut) /
    1_000_000;
  return usd * CLASS_COST.twdPerUsd * MESSAGES_PER_MINUTE;
}

/**
 * Chat minutes a week each paid plan has beyond the free plan's (D197).
 * The free plan's minutes are a free-tier cost every account has, like
 * the free plan itself; the price floor counts what a paid plan adds.
 */
export const PLAN_CHAT_EXTRA: Readonly<Record<PaidPlan, number>> = {
  plus:
    (PLANS.paid.chatMinutesPerWeek ?? 0) - (PLANS.free.chatMinutesPerWeek ?? 0),
  student:
    (PLANS.paid.chatMinutesPerWeek ?? 0) - (PLANS.free.chatMinutesPerWeek ?? 0),
  pro:
    (PLANS.pro.chatMinutesPerWeek ?? 0) - (PLANS.free.chatMinutesPerWeek ?? 0),
};

/** NT$ a month of `perWeek` chat minutes, all used (the worst case). */
export const chatMonthCost = (perWeek: number) =>
  perWeek * WEEKS_PER_MONTH * chatMinuteCost();

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
  /** Essay reviews a week, all used (WritingLoop, D187). */
  writingPerWeek = 0,
  /** Chat minutes a week beyond the free plan's, all used (D197). */
  chatPerWeek = 0,
): number {
  return (
    kept(paid) / PERIOD_MONTHS[period] -
    minutes * classCostPerMinute() -
    writingMonthCost(writingPerWeek) -
    chatMonthCost(chatPerWeek)
  );
}

/**
 * The lowest whole monthly price for a plan with `minutes` that keeps both
 * periods at or above the floor (a year is 10 months, D105, so the year
 * decides).
 */
export function minimumMonthly(
  minutes: number,
  writingPerWeek = 0,
  chatPerWeek = 0,
): number {
  let monthly = 1;
  while (
    !BILLING_PERIODS.every(
      (period) =>
        worstCaseMargin(
          period === "year" ? yearlyFromMonthly(monthly) : monthly,
          period,
          minutes,
          writingPerWeek,
          chatPerWeek,
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
        margin: worstCaseMargin(
          paid,
          period,
          minutes,
          PLAN_WRITING_REVIEWS[plan],
          PLAN_CHAT_EXTRA[plan],
        ),
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
