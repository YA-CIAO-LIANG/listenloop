import { describe, expect, it } from "vitest";
import { allowanceCost, planAllowance } from "@/lib/payments/costs";
import {
  minimumMonthly,
  PRICE_FLOOR,
  worstCaseMargin,
  worstCaseTable,
} from "@/lib/payments/price-floor";
import { PLAN_MONTHLY } from "@/lib/payments/pricing";
import { PLAN_LINES, PLAN_TIERS } from "@/lib/plans";

describe("the price floor (D185, beside the cost caps of D210)", () => {
  it("keeps every plan and period above it when every allowance is used", () => {
    const rows = worstCaseTable();
    // 9 personal plans and 9 class plans, monthly and yearly.
    expect(rows).toHaveLength(36);
    const under = rows
      .filter((row) => row.margin < PRICE_FLOOR.minMarginPerMonth)
      .map(
        (row) =>
          `${row.plan} ${row.period} NT$${row.paid}: NT$${row.margin.toFixed(1)}`,
      );
    expect(under).toEqual([]);
  });

  it("takes out tax, ECPay's fee, and the allowances' cost", () => {
    // Student listening, yearly: NT$900 → a month of it, less 5% tax and
    // 2.9% fee, less 2,400 words at the calibrated cost.
    const allowance = planAllowance("listening", "student");
    const margin = worstCaseMargin(900, "year", allowance);
    const kept = 900 / 1.05 - 900 * 0.029;
    expect(margin).toBeCloseTo(kept / 12 - allowanceCost(allowance));
    expect(margin).toBeGreaterThan(15);
  });

  it("names a lowest monthly price under every plan's price", () => {
    for (const line of PLAN_LINES) {
      for (const tier of PLAN_TIERS) {
        expect(
          PLAN_MONTHLY[line][tier],
          `${line}-${tier}`,
        ).toBeGreaterThanOrEqual(minimumMonthly(planAllowance(line, tier)));
      }
    }
  });
});
