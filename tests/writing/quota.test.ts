import { describe, expect, it } from "vitest";
import { can, PLANS } from "@/lib/plans";
import {
  PLAN_WRITING_REVIEWS,
  worstCaseMargin,
  writingReviewCost,
} from "@/lib/payments/price-floor";

describe("WritingLoop's allowances (D187)", () => {
  it("lets every plan finish a seven-day cycle (Day 1 and Day 7 reviews)", () => {
    for (const plan of ["free", "paid", "pro"] as const) {
      expect(PLANS[plan].writingReviewsPerWeek).toBeGreaterThanOrEqual(2);
    }
    expect(PLANS.admin.writingReviewsPerWeek).toBeNull();
  });

  it("stops at the week's reviews and the plan's essay length", () => {
    expect(can("free", { kind: "writing-review", thisWeek: 1 }).ok).toBe(true);
    expect(can("free", { kind: "writing-review", thisWeek: 2 })).toEqual({
      ok: false,
      limit: "writingReviewsPerWeek",
      max: 2,
    });
    expect(can("free", { kind: "writing-words", words: 401 })).toMatchObject({
      ok: false,
      limit: "writingWords",
    });
    expect(can("admin", { kind: "writing-review", thisWeek: 999 }).ok).toBe(
      true,
    );
  });

  it("puts the reviews in the price floor (D185)", () => {
    expect(writingReviewCost()).toBeGreaterThan(0.05);
    expect(writingReviewCost()).toBeLessThan(0.5);
    expect(PLAN_WRITING_REVIEWS.pro).toBeGreaterThan(PLAN_WRITING_REVIEWS.plus);
    expect(worstCaseMargin(1190, "year", 40, 3)).toBeLessThan(
      worstCaseMargin(1190, "year", 40),
    );
  });
});
