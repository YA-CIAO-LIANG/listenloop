import { describe, expect, it } from "vitest";
import { can, PLANS } from "@/lib/plans";
import { UNIT_COSTS } from "@/lib/payments/costs";

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

  it("costs a review as measured (D210)", () => {
    expect(UNIT_COSTS.essay).toBeGreaterThan(0.05);
    expect(UNIT_COSTS.essay).toBeLessThan(0.5);
    expect(PLANS.pro.writingReviewsPerWeek!).toBeGreaterThan(
      PLANS.paid.writingReviewsPerWeek!,
    );
  });
});
