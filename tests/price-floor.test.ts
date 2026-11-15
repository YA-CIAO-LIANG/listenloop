import { describe, expect, it } from "vitest";
import { classCostPerMinute } from "@/lib/classroom";
import {
  minimumMonthly,
  PLAN_MINUTES,
  PRICE_FLOOR,
  worstCaseMargin,
  worstCaseTable,
} from "@/lib/payments/price-floor";
import { PLAN_MONTHLY } from "@/lib/payments/pricing";

describe("the price floor (D185)", () => {
  it("keeps every plan and period above it when every minute is used", () => {
    const under = worstCaseTable()
      .filter((row) => row.margin < PRICE_FLOOR.minMarginPerMonth)
      .map(
        (row) =>
          `${row.plan} ${row.period} NT$${row.paid}: NT$${row.margin.toFixed(1)}`,
      );
    expect(under).toEqual([]);
  });

  it("takes out tax, ECPay's fee, and the minutes' cost", () => {
    // Student, yearly: NT$1,190 → a month of it, less 5% tax and 2.9% fee,
    // less 40 minutes at the worst-case cost.
    const margin = worstCaseMargin(1190, "year", 40);
    const kept = 1190 / 1.05 - 1190 * 0.029;
    expect(margin).toBeCloseTo(kept / 12 - 40 * classCostPerMinute());
    expect(margin).toBeGreaterThan(15);
  });

  it("would have caught the old prices", () => {
    // NT$900 a year for 40 minutes lost about NT$5 a month a subscriber.
    expect(worstCaseMargin(900, "year", 40)).toBeLessThan(0);
    expect(worstCaseMargin(2990, "year", 120)).toBeLessThan(15);
  });

  it("names the lowest monthly price for each plan's minutes", () => {
    expect(minimumMonthly(PLAN_MINUTES.plus)).toBe(117);
    expect(minimumMonthly(PLAN_MINUTES.pro)).toBe(310);
    for (const plan of ["plus", "student", "pro"] as const) {
      expect(PLAN_MONTHLY[plan]).toBeGreaterThanOrEqual(
        minimumMonthly(PLAN_MINUTES[plan]),
      );
    }
  });
});
