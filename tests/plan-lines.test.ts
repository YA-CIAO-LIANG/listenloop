import { describe, expect, it } from "vitest";
import { PLAN_MONTHLY, PLAN_PRICES } from "@/lib/payments/pricing";
import { unitPrices } from "@/lib/payments/costs";
import {
  ACCOUNT_PLANS,
  accountPlanFor,
  isPayingPlan,
  LISTENING_TIERS,
  PLAN_LINES,
  PLAN_TIERS,
  PLANS,
  planFor,
  planParts,
  WRITING_TIERS,
} from "@/lib/plans";

/** Plans in three lines and three tiers (D210, Joe 2026-11-24). */
describe("plan lines (D210)", () => {
  it("has Joe's prices, every year 10 × its month", () => {
    expect(PLAN_MONTHLY).toEqual({
      listening: { student: 90, plus: 149, pro: 299 },
      writing: { student: 119, plus: 149, pro: 249 },
      all: { student: 189, plus: 269, pro: 499 },
    });
    for (const line of PLAN_LINES) {
      for (const tier of PLAN_TIERS) {
        expect(PLAN_PRICES[line][tier].year.amount).toBe(
          PLAN_PRICES[line][tier].month.amount * 10,
        );
      }
    }
  });

  it("has Joe's allowances (Pro's writing raised only for the price order)", () => {
    expect(LISTENING_TIERS.student.wordsPerMonth).toBe(2_400);
    expect(LISTENING_TIERS.plus.wordsPerMonth).toBe(3_000);
    expect(LISTENING_TIERS.pro.wordsPerMonth).toBe(9_000);
    for (const tier of ["student", "plus"] as const) {
      expect(WRITING_TIERS[tier]).toMatchObject({
        writingReviewsPerWeek: 7,
        backChecksPerWeek: 21,
        chatMessagesPerWeek: 135,
      });
    }
    // Joe: 18, 54, 350; at least those, at most a little more.
    const pro = WRITING_TIERS.pro;
    expect(pro.writingReviewsPerWeek).toBeGreaterThanOrEqual(18);
    expect(pro.writingReviewsPerWeek).toBeLessThanOrEqual(20);
    expect(pro.backChecksPerWeek).toBeGreaterThanOrEqual(54);
    expect(pro.backChecksPerWeek).toBeLessThanOrEqual(58);
    expect(pro.chatMessagesPerWeek).toBeGreaterThanOrEqual(350);
    expect(pro.chatMessagesPerWeek).toBeLessThanOrEqual(370);
  });

  it("keeps the price per unit lowest on Pro, then student, then Plus, on every line", () => {
    for (const line of PLAN_LINES) {
      const units = unitPrices(line);
      expect(Object.keys(units).length, line).toBeGreaterThan(0);
      for (const [unit, per] of Object.entries(units)) {
        expect(per.pro, `${line} ${unit}`).toBeLessThan(per.student);
        expect(per.student, `${line} ${unit}`).toBeLessThan(per.plus);
      }
    }
    // Listening has words only, writing the three writing units, all four.
    expect(Object.keys(unitPrices("listening"))).toEqual(["words"]);
    expect(Object.keys(unitPrices("writing"))).toHaveLength(3);
    expect(Object.keys(unitPrices("all"))).toHaveLength(4);
  });

  it("gives each line its part, and free's elsewhere", () => {
    for (const tier of PLAN_TIERS) {
      const listening = PLANS[accountPlanFor("listening", tier)];
      const writing = PLANS[accountPlanFor("writing", tier)];
      const all = PLANS[accountPlanFor("all", tier)];
      // Only listening: writing is the free trial.
      expect(listening.writingReviewsPerWeek).toBe(
        PLANS.free.writingReviewsPerWeek,
      );
      expect(listening.chatMessagesPerWeek).toBe(
        PLANS.free.chatMessagesPerWeek,
      );
      expect(listening.uploadAudio).toBe(true);
      // Only writing: listening as on free.
      expect(writing.wordsPerWeek).toBe(PLANS.free.wordsPerWeek);
      expect(writing.wordsPerMonth).toBeNull();
      expect(writing.uploadAudio).toBe(false);
      expect(writing.sharedPractices).toBe(false);
      expect(writing.writingReviewsPerWeek).toBe(
        WRITING_TIERS[tier].writingReviewsPerWeek,
      );
      // All: both, not discounted.
      expect(all.wordsPerMonth).toBe(LISTENING_TIERS[tier].wordsPerMonth);
      expect(all.writingReviewsPerWeek).toBe(
        WRITING_TIERS[tier].writingReviewsPerWeek,
      );
      expect(all.uploadAudio).toBe(true);
      // The stats cover both: every paid plan.
      for (const limits of [listening, writing, all]) {
        expect(limits.fullStats).toBe(true);
      }
    }
    // Pro's listening extras stay on Pro.
    expect(PLANS["listening-pro"].priority).toBe(true);
    expect(PLANS["listening-plus"].priority).toBe(false);
    expect(PLANS["writing-pro"].priority).toBe(false);
  });

  it("keeps the old ids for the all-in-one line, so paid accounts moved there unchanged", () => {
    expect(accountPlanFor("all", "plus")).toBe("paid");
    expect(accountPlanFor("all", "student")).toBe("student");
    expect(accountPlanFor("all", "pro")).toBe("pro");
    expect(planParts("paid")).toEqual({ line: "all", tier: "plus" });
    expect(planParts("listening-pro")).toEqual({
      line: "listening",
      tier: "pro",
    });
    expect(planParts("free")).toBeNull();
    expect(planParts("admin")).toBeNull();
    for (const plan of ACCOUNT_PLANS) {
      const parts = planParts(plan);
      if (parts) expect(accountPlanFor(parts.line, parts.tier)).toBe(plan);
      expect(isPayingPlan(plan)).toBe(plan !== "free");
      expect(planFor({ role: "user", plan })).toBe(plan);
    }
    expect(ACCOUNT_PLANS).toHaveLength(10);
  });
});
