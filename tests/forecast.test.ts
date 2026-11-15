import { describe, expect, it } from "vitest";
import { classCostPerMinute, CLASS_COST } from "@/lib/classroom";
import {
  defaultForecastInput,
  ECPAY_FEE_RATE,
  forecast,
  FORECAST_PLANS,
  languageCostUsd,
  TW_BUSINESS_TAX,
  voicePerMinute,
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

describe("revenue forecast (D102, D184)", () => {
  const base = { ...defaultForecastInput(1), serverMonthly: 0 };

  it("defaults to ECPay's fee and Taiwan's 5% tax inside the price", () => {
    expect(base.feeRate).toBe(ECPAY_FEE_RATE);
    expect(base.feeFixed).toBe(0);
    expect(base.taxRate).toBe(TW_BUSINESS_TAX);
    expect(TW_BUSINESS_TAX).toBe(0.05);
  });

  it("takes the tax out of a Plus month, then fees and AI", () => {
    const r = forecast(only(base, "plus", "month", 1));
    expect(r.revenue).toBe(149);
    expect(r.tax).toBeCloseTo(149 - 149 / 1.05);
    expect(r.fees).toBeCloseTo(149 * ECPAY_FEE_RATE);
    // 40 minutes × 40% used × NT$1 a minute.
    expect(r.aiCost).toBeCloseTo(16);
    expect(r.net).toBeCloseTo(149 / 1.05 - 149 * ECPAY_FEE_RATE - 16);
    expect(r.grossMargin).toBeCloseTo(r.net / (149 / 1.05));
  });

  it("spreads a year over 12 months, fees included", () => {
    const r = forecast(only(base, "student", "year", 12));
    expect(r.revenue).toBeCloseTo(1190);
    expect(r.cash).toBe(12 * 1190);
    expect(r.fees).toBeCloseTo(1190 * ECPAY_FEE_RATE);
  });

  it("charges a fixed fee per payment when one is set", () => {
    const r = forecast({
      ...only(base, "plus", "year", 12),
      feeRate: 0,
      feeFixed: 16,
    });
    // 12 yearly payments a year: one a month.
    expect(r.fees).toBeCloseTo(16);
  });

  it("without tax, the margin is on the whole price", () => {
    const r = forecast({ ...only(base, "plus", "month", 1), taxRate: 0 });
    expect(r.tax).toBe(0);
    expect(r.grossMargin).toBeCloseTo(r.net / 149);
  });

  it("prices the voice like the class plans' worst case (D173)", () => {
    const voice = voicePerMinute(CLASS_COST.twdPerUsd);
    expect(voice).toBeCloseTo((1209 * 30 * 32) / 1_000_000);
    expect(CLASS_COST.languageUsdPerMinute * 32 + voice).toBeCloseTo(
      classCostPerMinute(),
    );
  });

  it("counts language models only: no evals, no voice", () => {
    expect(
      languageCostUsd([
        { operation: "annotate", cost_micros: 1_000_000 },
        { operation: "translate", cost_micros: 500_000 },
        { operation: "eval:annotate", cost_micros: 9_000_000 },
        { operation: "speech", cost_micros: 2_000_000 },
        { operation: "transcribe", cost_micros: 3_000_000 },
        { operation: "segment", cost_micros: null },
      ]),
    ).toBeCloseTo(1.5);
  });
});
