import { describe, expect, it } from "vitest";
import { defaultForecastInput, forecast } from "@/lib/forecast";
import {
  funnel,
  shares,
  weekOf,
  weeklyTrend,
  type IntentRow,
} from "@/lib/interest";
import { PLAN_PRICES, prepaidRefund } from "@/lib/payments/pricing";
import { can, planFor, PLANS } from "@/lib/plans";

describe("prices (D102)", () => {
  it("are Joe's monthly prices; a year is ten of them (D105)", () => {
    expect(PLAN_PRICES.plus).toMatchObject({
      month: { amount: 149 },
      year: { amount: 1490 },
    });
    expect(PLAN_PRICES.pro).toMatchObject({
      month: { amount: 299 },
      year: { amount: 2990 },
    });
    expect(Object.keys(PLAN_PRICES.plus)).toEqual(["month", "year"]);
  });

  it("refunds all within 7 days, then the unused whole months at the plan's rate", () => {
    expect(prepaidRefund("plus", "year", 3, 0)).toBe(1490);
    // 8 unused months × 1,490 ÷ 12.
    expect(prepaidRefund("plus", "year", 100, 3.2)).toBe(993);
    expect(prepaidRefund("pro", "year", 200, 6.5)).toBe(1246);
    expect(prepaidRefund("plus", "month", 20, 0.7)).toBe(0);
  });
});

describe("plans (D102)", () => {
  it("free makes 2 minutes a week (D143); Plus 40 and Pro 120 minutes a month", () => {
    expect(PLANS.free).toMatchObject({
      practicesTotal: null,
      minutesPerWeek: 2,
      maxPracticeSeconds: 120,
    });
    expect(PLANS.paid).toMatchObject({
      minutesPerMonth: 40,
      maxPracticeSeconds: 300,
    });
    expect(PLANS.pro).toMatchObject({
      minutesPerMonth: 120,
      maxPracticeSeconds: 600,
    });
    expect(
      can("paid", { kind: "create-practice", secondsThisMonth: 39 * 60 }).ok,
    ).toBe(true);
    expect(
      can("paid", { kind: "create-practice", secondsThisMonth: 40 * 60 }),
    ).toEqual({ ok: false, limit: "minutesPerMonth", max: 40 });
    expect(
      can("pro", { kind: "create-practice", secondsThisMonth: 100 * 60 }).ok,
    ).toBe(true);
  });

  it("gates Plus features, and knows Pro accounts", () => {
    for (const feature of ["playbackSpeed", "fullStats"] as const) {
      expect(can("free", { kind: "feature", feature }).ok).toBe(false);
      expect(can("paid", { kind: "feature", feature }).ok).toBe(true);
    }
    expect(can("paid", { kind: "feature", feature: "batchPdf" }).ok).toBe(
      false,
    );
    expect(can("pro", { kind: "feature", feature: "batchPdf" }).ok).toBe(true);
    expect(planFor({ role: "user", plan: "pro" })).toBe("pro");
  });
});

const row = (over: Partial<IntentRow>): IntentRow => ({
  created_at: "2026-11-09T02:00:00Z",
  user_id: null,
  visitor_id: "visitor-1",
  step: "pricing_view",
  plan: null,
  billing_interval: null,
  source: "direct",
  ...over,
});

describe("interest funnel (D102)", () => {
  const rows = [
    row({}),
    row({}), // the same visitor again: still one person
    row({ visitor_id: "visitor-2", source: "stats" }),
    row({ visitor_id: "visitor-3" }),
    row({ visitor_id: "visitor-4" }),
    row({ step: "subscribe_click", plan: "plus", billing_interval: "year" }),
    row({
      step: "subscribe_click",
      visitor_id: "visitor-2",
      plan: "pro",
      billing_interval: "year",
    }),
    row({ step: "waitlist_join", plan: "plus" }),
  ];

  it("counts people once per step, with rates of those who saw pricing", () => {
    const steps = funnel(rows);
    expect(steps.find((s) => s.step === "pricing_view")).toMatchObject({
      people: 4,
      rate: null,
    });
    expect(steps.find((s) => s.step === "subscribe_click")).toMatchObject({
      people: 2,
      rate: 0.5,
    });
    expect(steps.find((s) => s.step === "waitlist_join")).toMatchObject({
      people: 1,
      rate: 0.25,
    });
  });

  it("splits by plan, period, and source", () => {
    expect(shares(rows, "subscribe_click", "plan")).toEqual([
      { value: "plus", people: 1, share: 0.5 },
      { value: "pro", people: 1, share: 0.5 },
    ]);
    expect(shares(rows, "pricing_view", "source")[0]).toMatchObject({
      value: "direct",
      people: 3,
    });
  });

  it("groups by Taiwan weeks starting Monday", () => {
    // Sunday 20:00 UTC is Monday 04:00 in Taiwan.
    expect(weekOf("2026-11-08T20:00:00Z")).toBe("2026-11-09");
    expect(weekOf("2026-11-08T10:00:00Z")).toBe("2026-11-02");
    const trend = weeklyTrend(rows, new Date("2026-11-10T00:00:00Z"), 2);
    expect(trend.map((w) => w.week)).toEqual(["2026-11-02", "2026-11-09"]);
    expect(trend[1].counts.pricing_view).toBe(4);
  });
});

describe("revenue forecast (D102)", () => {
  it("spreads prepaid plans by month and takes their cash up front", () => {
    const input = defaultForecastInput(0.6);
    for (const plan of ["plus", "pro", "student"] as const) {
      for (const period of ["month", "year"] as const) {
        input.subscribers[plan][period] = 0;
      }
    }
    input.subscribers.plus.year = 12;
    input.feeRate = 0;
    input.serverMonthly = 0;
    input.usage.plus = 0.5;
    const result = forecast(input);
    expect(result.revenue).toBe(1490); // 12 × 1,490 ÷ 12
    expect(result.cash).toBe(17880);
    expect(result.aiCost).toBeCloseTo(12 * 40 * 0.5 * 0.6);
    expect(result.net).toBeCloseTo(1490 - 144);
    expect(result.grossMargin).toBeCloseTo((1490 - 144) / 1490);
  });
});
