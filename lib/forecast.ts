import {
  BILLING_PERIODS,
  PAID_PLANS,
  PERIOD_MONTHS,
  PLAN_PRICES,
  type BillingPeriod,
  type PaidPlan,
} from "./payments/pricing";
import {
  CLASS_COST,
  CLASS_TIERS,
  classPrice,
  type ClassTierId,
} from "./classroom";
import { PLANS } from "./plans";

/**
 * The plans the forecast counts (D173): the personal ones, and each class
 * tier (its teacher's minutes; students use their own plan).
 */
export const FORECAST_PLANS = [
  ...PAID_PLANS,
  "classSmall",
  "classStandard",
  "classLarge",
] as const;
export type ForecastPlan = (typeof FORECAST_PLANS)[number];

const CLASS_PLAN_TIER: Readonly<Record<string, ClassTierId>> = {
  classSmall: "small",
  classStandard: "standard",
  classLarge: "large",
};
const tierOf = (plan: ForecastPlan) =>
  CLASS_TIERS.find((tier) => tier.id === CLASS_PLAN_TIER[plan]);

/**
 * The admin's revenue forecast (D102, D184): a month of a business with
 * the given subscribers, in NT$. Prices include Taiwan's 5% business tax
 * (consumer prices are shown with tax), so the tax is taken out first.
 * Prepaid periods are counted as revenue a month at a time (their price
 * ÷ months); the cash comes in up front.
 */
export type ForecastInput = {
  /** Subscribers per plan and period, and the price each pays. */
  subscribers: Record<ForecastPlan, Record<BillingPeriod, number>>;
  prices: Record<ForecastPlan, Record<BillingPeriod, number>>;
  /** Share of the monthly minutes people actually use, 0–1. */
  usage: Record<ForecastPlan, number>;
  /** AI cost to make one minute of practice (text, notes, voice), NT$. */
  aiPerMinute: number;
  /** Business tax included in the prices, 0–1 (5% in Taiwan). */
  taxRate: number;
  /** Payment fees: a share of each payment, plus a fixed amount, NT$. */
  feeRate: number;
  feeFixed: number;
  /** Hosting and database a month, NT$. */
  serverMonthly: number;
};

export type ForecastResult = {
  /** What subscribers pay a month, tax included. */
  revenue: number;
  /** The business tax inside `revenue`. */
  tax: number;
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

const MINUTES: Readonly<Record<ForecastPlan, number>> = {
  plus: PLANS.paid.minutesPerMonth ?? 0,
  pro: PLANS.pro.minutesPerMonth ?? 0,
  // Plus at a student price (D144).
  student: PLANS.paid.minutesPerMonth ?? 0,
  // A class plan's teacher (D173).
  classSmall: tierOf("classSmall")?.minutes ?? 0,
  classStandard: tierOf("classStandard")?.minutes ?? 0,
  classLarge: tierOf("classLarge")?.minutes ?? 0,
};

/**
 * Defaults for ECPay (綠界, D184): about 2.75% a card payment, plus 5%
 * tax on that fee ≈ 2.9%, no fixed fee; the real rate is in the contract.
 */
export const ECPAY_FEE_RATE = 0.029;
export const TW_BUSINESS_TAX = 0.05;

/**
 * Voice a minute of practice costs once past the free tier, NT$ (D184):
 * the measured characters a minute at the higher paid voice price, the
 * same worst case as the class plans (D173).
 */
export function voicePerMinute(twdPerUsd: number = CLASS_COST.twdPerUsd) {
  return (
    ((CLASS_COST.voiceCharsPerMinute * CLASS_COST.voiceUsdPerMillionChars) /
      1_000_000) *
    twdPerUsd
  );
}

/** Operations that are voice, priced by voicePerMinute instead. */
const VOICE_OPERATIONS = new Set(["speech", "transcribe"]);

/**
 * US$ of language-model calls among `calls` (D184): evals (`eval:…`, not
 * a learner's practice) and voice (counted by voicePerMinute, free today
 * on Azure F0 so logged as 0) are left out.
 */
export function languageCostUsd(
  calls: readonly { operation: string; cost_micros: number | null }[],
): number {
  return (
    calls
      .filter(
        (c) =>
          !c.operation.startsWith("eval:") &&
          !VOICE_OPERATIONS.has(c.operation),
      )
      .reduce((sum, c) => sum + (c.cost_micros ?? 0), 0) / 1e6
  );
}

const priceOf = (plan: ForecastPlan, period: BillingPeriod): number => {
  const tier = tierOf(plan);
  return tier
    ? classPrice(tier, period)
    : PLAN_PRICES[plan as PaidPlan][period].amount;
};

export function defaultForecastInput(aiPerMinute: number): ForecastInput {
  const grid = <T>(value: (plan: ForecastPlan, period: BillingPeriod) => T) =>
    Object.fromEntries(
      FORECAST_PLANS.map((plan) => [
        plan,
        Object.fromEntries(BILLING_PERIODS.map((p) => [p, value(plan, p)])),
      ]),
    ) as Record<ForecastPlan, Record<BillingPeriod, T>>;
  return {
    subscribers: grid(
      (plan, period) =>
        ({
          plus: { month: 30, year: 60 },
          pro: { month: 5, year: 12 },
          student: { month: 10, year: 10 },
          // Cram schools and teachers mostly pay by the school year.
          classSmall: { month: 2, year: 3 },
          classStandard: { month: 1, year: 3 },
          classLarge: { month: 0, year: 1 },
        })[plan][period],
    ),
    prices: grid(priceOf),
    usage: {
      plus: 0.4,
      pro: 0.4,
      student: 0.4,
      classSmall: 0.6,
      classStandard: 0.6,
      classLarge: 0.6,
    },
    aiPerMinute,
    taxRate: TW_BUSINESS_TAX,
    feeRate: ECPAY_FEE_RATE,
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
  for (const plan of FORECAST_PLANS) {
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
  const taxRate = Math.max(0, input.taxRate);
  const tax = revenue - revenue / (1 + taxRate);
  // Margin on what's ours: revenue without the tax.
  const income = revenue - tax;
  const gross = income - aiCost - fees;
  return {
    revenue,
    tax,
    cash,
    aiCost,
    fees,
    serverCost,
    grossMargin: income > 0 ? gross / income : 0,
    net: gross - serverCost,
    subscribers,
  };
}
