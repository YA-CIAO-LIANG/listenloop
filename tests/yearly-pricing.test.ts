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
import { PLAN_LINES } from "@/lib/plans";
import en from "@/messages/en.json";
import zh from "@/messages/zh-Hant.json";

/**
 * The yearly rule (D105): every plan's yearly price is its monthly price
 * × 10, so a year is cheaper than 12 months and saves exactly two.
 */
const plans: { name: string; monthly: number; yearly: number }[] = [
  // Every line and tier (D210); the student plan too (D173).
  ...PLAN_LINES.flatMap((line) =>
    PAID_PLANS.map((plan) => ({
      name: `${line}-${plan}`,
      monthly: PLAN_PRICES[line][plan].month.amount,
      yearly: PLAN_PRICES[line][plan].year.amount,
    })),
  ),
  {
    name: "checkout (D85)",
    monthly: PRICES.month.amount,
    yearly: PRICES.year.amount,
  },
  ...CLASS_TIERS.flatMap((tier) =>
    PLAN_LINES.map((line) => ({
      name: `class, ${tier.id}, ${line}`,
      monthly: classPrice(tier, "month", line),
      yearly: classPrice(tier, "year", line),
    })),
  ),
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
    for (const line of PLAN_LINES) {
      for (const plan of PAID_PLANS) expect(monthsSaved(plan, line)).toBe(2);
    }
  });

  it("are Joe's personal prices (D210), checkout charging Plus all-in-one", () => {
    expect(PLAN_PRICES.all.plus.year.amount).toBe(2690);
    expect(PLAN_PRICES.listening.student.year.amount).toBe(900);
    expect(PRICES).toEqual(PLAN_PRICES.all.plus);
    expect(averagePerMonth(1190)).toBe(99);
  });

  it("are Joe's class prices (D210): all-in-one NT$5,990, NT$8,990, NT$13,900 a year", () => {
    expect(CLASS_TIERS.map((tier) => classPrice(tier, "year"))).toEqual([
      5990, 8990, 13900,
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

describe("pricing text (D105, D210)", () => {
  it("shows no discount percentage or 折, except the savings Joe asked for", () => {
    for (const messages of [zh, en]) {
      // "Cheaper than Plus by xx%", "xx% less per unit" (D210): computed.
      const { savings, ...plansPage } = messages.plansPage;
      expect(JSON.stringify(savings)).toMatch(/\{percent\}/);
      const text = JSON.stringify([
        plansPage,
        messages.classPricing,
        messages.pricing,
      ]);
      expect(text).not.toMatch(/%|折|percent/);
    }
  });
});
