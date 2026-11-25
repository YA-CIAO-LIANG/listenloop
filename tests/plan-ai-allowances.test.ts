import { describe, expect, it } from "vitest";
import { isPayingPlan, planFor, PLANS } from "@/lib/plans";
import {
  PLAN_BACK_CHECK_EXTRA,
  PLAN_CHAT_EXTRA,
  PLAN_WRITING_REVIEWS,
  PRICE_FLOOR,
  worstCaseMargin,
} from "@/lib/payments/price-floor";
import { PLAN_PRICES } from "@/lib/payments/pricing";

/**
 * The paid plans' AI writing allowances (D207, Joe 2026-11-24): Plus
 * clearly more than free, the student plan its own (a little more than
 * free, within its price's floor), Pro at least Plus in each; the rest of
 * the student plan is Plus.
 */
const AI = [
  "writingReviewsPerWeek",
  "chatMinutesPerWeek",
  "backChecksPerWeek",
] as const;

describe("AI writing allowances by plan (D207)", () => {
  it("gives Plus clearly more than free: at least 1.4 times each", () => {
    for (const key of AI) {
      expect(PLANS.paid[key]!, key).toBeGreaterThanOrEqual(
        PLANS.free[key]! * 1.4,
      );
    }
  });

  it("gives the student plan more than free in all, never more than Plus", () => {
    const total = (plan: "free" | "student") =>
      AI.reduce((sum, key) => sum + PLANS[plan][key]!, 0);
    expect(total("student")).toBeGreaterThan(total("free"));
    for (const key of AI) {
      expect(PLANS.student[key]!, key).toBeGreaterThanOrEqual(PLANS.free[key]!);
      expect(PLANS.student[key]!, key).toBeLessThanOrEqual(PLANS.paid[key]!);
    }
  });

  it("gives Pro at least Plus in each", () => {
    for (const key of AI) {
      expect(PLANS.pro[key]!, key).toBeGreaterThanOrEqual(PLANS.paid[key]!);
    }
  });

  it("keeps the rest of the student plan the same as Plus", () => {
    const rest = (plan: "paid" | "student") =>
      Object.fromEntries(
        Object.entries(PLANS[plan]).filter(
          ([key]) => !(AI as readonly string[]).includes(key),
        ),
      );
    expect(rest("student")).toEqual(rest("paid"));
  });

  it("keeps the student plan at its price and above the floor, with its own allowances", () => {
    expect(PLAN_PRICES.student.month.amount).toBe(119);
    expect(PLAN_PRICES.student.year.amount).toBe(1190);
    expect(PLAN_WRITING_REVIEWS.student).toBe(
      PLANS.student.writingReviewsPerWeek,
    );
    const margin = worstCaseMargin(
      PLAN_PRICES.student.year.amount,
      "year",
      PLANS.student.minutesPerMonth ?? 0,
      PLAN_WRITING_REVIEWS.student,
      PLAN_CHAT_EXTRA.student,
      PLAN_BACK_CHECK_EXTRA.student,
    );
    expect(margin).toBeGreaterThanOrEqual(PRICE_FLOOR.minMarginPerMonth);
  });

  it("puts a student account on the student plan, a paying plan", () => {
    expect(planFor({ role: "user", plan: "student" })).toBe("student");
    expect(isPayingPlan("student")).toBe(true);
    expect(isPayingPlan("free")).toBe(false);
  });
});
