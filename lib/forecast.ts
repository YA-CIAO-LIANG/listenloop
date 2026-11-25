import { CLASS_TIERS, classPrice } from "./classroom";
import {
  classCostRows,
  personalCostRows,
  type CostRow,
} from "./payments/costs";
import {
  BILLING_PERIODS,
  PERIOD_MONTHS,
  PLAN_PRICES,
  type BillingPeriod,
} from "./payments/pricing";
import type { PlanLine, PlanTier } from "./plans";

/**
 * The plans the forecast counts (D173, D210): every personal line and
 * tier ("all-plus"), and every class size and line ("class-small-all").
 */
export const COST_ROWS: readonly CostRow[] = [
  ...personalCostRows(),
  ...classCostRows(CLASS_TIERS),
];
export const FORECAST_PLANS = COST_ROWS.map((row) => row.id);
export type ForecastPlan = string;

const rowOf = (plan: ForecastPlan) => COST_ROWS.find((row) => row.id === plan)!;

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
  /** Share of the allowances people actually use, 0–1. */
  usage: Record<ForecastPlan, number>;
  /**
   * The calibrated AI and voice costs (lib/payments/costs.ts) times this:
   * 1 as measured; more to see what dearer AI would do.
   */
  costScale: number;
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

/**
 * Defaults for ECPay (綠界, D184): about 2.75% a card payment, plus 5%
 * tax on that fee ≈ 2.9%, no fixed fee; the real rate is in the contract.
 */
export const ECPAY_FEE_RATE = 0.029;
export const TW_BUSINESS_TAX = 0.05;

const priceOf = (plan: ForecastPlan, period: BillingPeriod): number => {
  const row = rowOf(plan);
  if (row.kind === "class") {
    const tier = CLASS_TIERS.find((t) => t.id === row.tier)!;
    return classPrice(tier, period, row.line);
  }
  return PLAN_PRICES[row.line][row.tier as PlanTier][period].amount;
};

/** Default subscribers: most on the "all" line, yearly a little ahead. */
const DEFAULT_PEOPLE: Readonly<
  Record<PlanLine, Readonly<Record<string, Record<BillingPeriod, number>>>>
> = {
  listening: {
    student: { month: 5, year: 5 },
    plus: { month: 10, year: 15 },
    pro: { month: 2, year: 3 },
  },
  writing: {
    student: { month: 5, year: 5 },
    plus: { month: 10, year: 15 },
    pro: { month: 2, year: 3 },
  },
  all: {
    student: { month: 5, year: 10 },
    plus: { month: 20, year: 40 },
    pro: { month: 3, year: 8 },
  },
};

export function defaultForecastInput(): ForecastInput {
  const grid = <T>(value: (plan: ForecastPlan, period: BillingPeriod) => T) =>
    Object.fromEntries(
      FORECAST_PLANS.map((plan) => [
        plan,
        Object.fromEntries(BILLING_PERIODS.map((p) => [p, value(plan, p)])),
      ]),
    ) as Record<ForecastPlan, Record<BillingPeriod, T>>;
  return {
    subscribers: grid((plan, period) => {
      const row = rowOf(plan);
      if (row.kind === "personal") {
        return DEFAULT_PEOPLE[row.line][row.tier][period];
      }
      // Cram schools and teachers mostly pay by the school year.
      return row.line === "all" && period === "year"
        ? row.tier === "large"
          ? 1
          : 2
        : 0;
    }),
    prices: grid(priceOf),
    usage: Object.fromEntries(
      FORECAST_PLANS.map((plan) => [
        plan,
        rowOf(plan).kind === "class" ? 0.6 : 0.4,
      ]),
    ),
    costScale: 1,
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
      aiCost +=
        people *
        rowOf(plan).fullCost *
        Math.max(0, input.usage[plan] ?? 0) *
        Math.max(0, input.costScale);
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
