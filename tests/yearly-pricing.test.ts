import { describe, expect, it } from "vitest";
import { CLASS_TIERS, classPrice } from "@/lib/classroom";
import {
  averagePerMonth,
  BILLING_PERIODS,
  monthsSaved,
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
  // The student plan too, since its exception was dropped (D173).
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
  ...CLASS_TIERS.map((tier) => ({
    name: `class, ${tier.id}`,
    monthly: classPrice(tier, "month"),
    yearly: classPrice(tier, "year"),
  })),
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
    expect(monthsSaved("plus")).toBe(2);
    expect(monthsSaved("pro")).toBe(2);
    expect(monthsSaved("student")).toBe(2);
  });

  it("are the personal prices (D173, D185): student NT$119/1,190, Plus 149/1,490, Pro 319/3,190", () => {
    expect(
      Object.fromEntries(
        PAID_PLANS.map((plan) => [
          plan,
          [PLAN_PRICES[plan].month.amount, PLAN_PRICES[plan].year.amount],
        ]),
      ),
    ).toEqual({ plus: [149, 1490], pro: [319, 3190], student: [119, 1190] });
    expect(averagePerMonth(1190)).toBe(99);
  });

  it("are Joe's class prices (D173): NT$3,490, NT$5,490, NT$8,000 a year", () => {
    expect(CLASS_TIERS.map((tier) => classPrice(tier, "year"))).toEqual([
      3490, 5490, 8000,
    ]);
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
