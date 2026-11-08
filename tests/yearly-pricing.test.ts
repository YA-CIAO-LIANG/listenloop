import { describe, expect, it } from "vitest";
import { CLASS_PLAN, classPrice } from "@/lib/classroom";
import {
  averagePerMonth,
  BILLING_PERIODS,
  PAID_PLANS,
  PLAN_PRICES,
  PRICES,
  YEARLY_MONTHS_FREE,
} from "@/lib/payments/pricing";
import en from "@/messages/en.json";
import zh from "@/messages/zh-Hant.json";

/**
 * The yearly rule (D105): every plan's yearly price is its monthly price
 * × 10, so a year is cheaper than 12 months and saves exactly two.
 */
const plans: { name: string; monthly: number; yearly: number }[] = [
  ...PAID_PLANS.map((plan) => ({
    name: plan,
    monthly: PLAN_PRICES[plan].month.amount,
    yearly: PLAN_PRICES[plan].year.amount,
  })),
  {
    name: "checkout (D85)",
    monthly: PRICES.month.amount,
    yearly: PRICES.year.amount,
  },
  {
    name: "class",
    monthly: classPrice("month"),
    yearly: classPrice("year"),
  },
  {
    name: "class, priority list",
    monthly: classPrice("month", { priority: true }),
    yearly: classPrice("year", { priority: true }),
  },
];

describe("yearly prices (D105)", () => {
  for (const { name, monthly, yearly } of plans) {
    it(`${name}: a year is less than 12 months and exactly 10`, () => {
      expect(yearly).toBeLessThan(monthly * 12);
      expect(yearly).toBe(monthly * 10);
    });
  }

  it("saves two months", () => {
    expect(YEARLY_MONTHS_FREE).toBe(2);
  });

  it("are Joe's class prices: NT$4,990, and NT$3,490 for the priority list", () => {
    expect(classPrice("year")).toBe(4990);
    expect(classPrice("year", { priority: true })).toBe(3490);
    expect(CLASS_PLAN.monthly).toBe(499);
  });

  it("averages the yearly price over 12 months, rounded", () => {
    expect(averagePerMonth(1490)).toBe(124); // 124.17
    expect(averagePerMonth(2990)).toBe(249); // 249.17
    expect(averagePerMonth(4990)).toBe(416); // 415.83
    expect(averagePerMonth(3490)).toBe(291); // 290.83
  });

  it("are billed monthly or yearly only", () => {
    expect([...BILLING_PERIODS]).toEqual(["month", "year"]);
  });
});

describe("pricing text (D105)", () => {
  it("shows no discount percentage or 折", () => {
    for (const messages of [zh, en]) {
      const text = JSON.stringify([
        messages.plansPage,
        messages.classPricing,
        messages.pricing,
      ]);
      expect(text).not.toMatch(/%|折|percent/);
    }
  });
});
