import {
  BILLING_PERIODS,
  PAID_PLANS,
  PERIOD_MONTHS,
  PLAN_PRICES,
  type BillingPeriod,
  type PaidPlan,
} from "./payments/pricing";
import { PLANS } from "./plans";

/**
 * The admin's revenue forecast (D102): a month of a business with the
 * given subscribers, in NT$. Prepaid periods are counted as revenue a
 * month at a time (their price ÷ months); the cash comes in up front.
 */
export type ForecastInput = {
  /** Subscribers per plan and period, and the price each pays. */
  subscribers: Record<PaidPlan, Record<BillingPeriod, number>>;
  prices: Record<PaidPlan, Record<BillingPeriod, number>>;
  /** Share of the monthly minutes people actually use, 0–1. */
  usage: Record<PaidPlan, number>;
  /** AI cost to make one minute of practice (text, notes, voice), NT$. */
  aiPerMinute: number;
  /** Payment fees: a share of each payment, plus a fixed amount, NT$. */
  feeRate: number;
  feeFixed: number;
  /** Hosting and database a month, NT$. */
  serverMonthly: number;
};

export type ForecastResult = {
  revenue: number;
  /**
   * Cash collected up front: what these subscribers pay when they sign
   * up (a yearly one pays the year at once).
   */
  cash: number;
  aiCost: number;
  fees: number;
  serverCost: number;
  grossMargin: number;
  net: number;
  subscribers: number;
};

const MINUTES = {
  plus: PLANS.paid.minutesPerMonth ?? 0,
  pro: PLANS.pro.minutesPerMonth ?? 0,
};

export function defaultForecastInput(aiPerMinute: number): ForecastInput {
  const grid = <T>(value: (plan: PaidPlan, period: BillingPeriod) => T) =>
    Object.fromEntries(
      PAID_PLANS.map((plan) => [
        plan,
        Object.fromEntries(BILLING_PERIODS.map((p) => [p, value(plan, p)])),
      ]),
    ) as Record<PaidPlan, Record<BillingPeriod, T>>;
  return {
    subscribers: grid((plan, period) =>
      plan === "plus"
        ? { month: 30, year: 60 }[period]
        : { month: 5, year: 12 }[period],
    ),
    prices: grid((plan, period) => PLAN_PRICES[plan][period].amount),
    usage: { plus: 0.4, pro: 0.4 },
    aiPerMinute,
    feeRate: 0.028,
    feeFixed: 0,
    serverMonthly: 1500,
  };
}

export function forecast(input: ForecastInput): ForecastResult {
  let revenue = 0;
  let cash = 0;
  let aiCost = 0;
  let fees = 0;
  let subscribers = 0;
  for (const plan of PAID_PLANS) {
    for (const period of BILLING_PERIODS) {
      const people = Math.max(0, input.subscribers[plan][period]);
      const price = Math.max(0, input.prices[plan][period]);
      const months = PERIOD_MONTHS[period];
      subscribers += people;
      revenue += (people * price) / months;
      cash += people * price;
      fees += (people / months) * (price * input.feeRate + input.feeFixed);
      aiCost += people * MINUTES[plan] * input.usage[plan] * input.aiPerMinute;
    }
  }
  const serverCost = input.serverMonthly;
  const gross = revenue - aiCost - fees;
  return {
    revenue,
    cash,
    aiCost,
    fees,
    serverCost,
    grossMargin: revenue > 0 ? gross / revenue : 0,
    net: gross - serverCost,
    subscribers,
  };
}
