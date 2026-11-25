import { describe, expect, it } from "vitest";
import {
  COST_ROWS,
  defaultForecastInput,
  ECPAY_FEE_RATE,
  forecast,
  FORECAST_PLANS,
  TW_BUSINESS_TAX,
  type ForecastInput,
} from "@/lib/forecast";
import { BILLING_PERIODS } from "@/lib/payments/pricing";

/** No one subscribed, except what `only` says. */
function only(
  base: ForecastInput,
  plan: (typeof FORECAST_PLANS)[number],
  period: (typeof BILLING_PERIODS)[number],
  people: number,
): ForecastInput {
  const subscribers = Object.fromEntries(
    FORECAST_PLANS.map((p) => [
      p,
      Object.fromEntries(
        BILLING_PERIODS.map((x) => [
          x,
          p === plan && x === period ? people : 0,
        ]),
      ),
    ]),
  ) as ForecastInput["subscribers"];
  return { ...base, subscribers };
}

const fullCost = (plan: string) =>
  COST_ROWS.find((row) => row.id === plan)!.fullCost;

describe("revenue forecast (D102, D184, D210)", () => {
  const base = { ...defaultForecastInput(), serverMonthly: 0 };

  it("has every personal and class plan of the three lines", () => {
    expect(FORECAST_PLANS).toHaveLength(18);
    expect(FORECAST_PLANS).toContain("all-plus");
    expect(FORECAST_PLANS).toContain("listening-student");
    expect(FORECAST_PLANS).toContain("class-large-writing");
  });

  it("defaults to ECPay's fee and Taiwan's 5% tax inside the price", () => {
    expect(base.feeRate).toBe(ECPAY_FEE_RATE);
    expect(base.feeFixed).toBe(0);
    expect(base.taxRate).toBe(TW_BUSINESS_TAX);
    expect(TW_BUSINESS_TAX).toBe(0.05);
    expect(base.costScale).toBe(1);
  });

  it("takes the tax out of a Plus month, then fees and AI", () => {
    const r = forecast(only(base, "all-plus", "month", 1));
    expect(r.revenue).toBe(269);
    expect(r.tax).toBeCloseTo(269 - 269 / 1.05);
    expect(r.fees).toBeCloseTo(269 * ECPAY_FEE_RATE);
    // The plan's full-use cost × 40% used.
    expect(r.aiCost).toBeCloseTo(fullCost("all-plus") * 0.4);
    expect(r.net).toBeCloseTo(
      269 / 1.05 - 269 * ECPAY_FEE_RATE - fullCost("all-plus") * 0.4,
    );
    expect(r.grossMargin).toBeCloseTo(r.net / (269 / 1.05));
  });

  it("spreads a year over 12 months, fees included", () => {
    const r = forecast(only(base, "writing-student", "year", 12));
    expect(r.revenue).toBeCloseTo(1190);
    expect(r.cash).toBe(12 * 1190);
    expect(r.fees).toBeCloseTo(1190 * ECPAY_FEE_RATE);
  });

  it("charges a fixed fee per payment when one is set", () => {
    const r = forecast({
      ...only(base, "listening-plus", "year", 12),
      feeRate: 0,
      feeFixed: 16,
    });
    // 12 yearly payments a year: one a month.
    expect(r.fees).toBeCloseTo(16);
  });

  it("without tax, the margin is on the whole price", () => {
    const r = forecast({
      ...only(base, "listening-plus", "month", 1),
      taxRate: 0,
    });
    expect(r.tax).toBe(0);
    expect(r.grossMargin).toBeCloseTo(r.net / 149);
  });

  it("scales the calibrated costs by the cost factor", () => {
    const one = forecast(only(base, "all-pro", "month", 1));
    const two = forecast({
      ...only(base, "all-pro", "month", 1),
      costScale: 2,
    });
    expect(two.aiCost).toBeCloseTo(one.aiCost * 2);
  });

  it("prices class plans by size and line", () => {
    const r = forecast(only(base, "class-standard-writing", "month", 1));
    expect(r.revenue).toBe(449);
    // Class plans default to 60% used.
    expect(r.aiCost).toBeCloseTo(fullCost("class-standard-writing") * 0.6);
  });
});
