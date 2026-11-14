import { describe, expect, it } from "vitest";
import { PLAN_PRICES } from "@/lib/payments/pricing";
import {
  assignVariant,
  effectivePrices,
  parseExperiment,
  parseVariants,
  priceView,
  revenuePerVisitor,
  suggestedWinner,
  twoProportionP,
  variantStats,
  verdict,
  type PriceExperiment,
  type VariantStats,
} from "@/lib/price-experiments";
import {
  cleanPriceAnswers,
  priceCurves,
  priceRange,
  type PriceAnswers,
} from "@/lib/price-survey";

const experiment: PriceExperiment = {
  id: "11111111-1111-4111-8111-111111111111",
  plan: "plus",
  variants: [
    { key: "a", monthly: 149 },
    { key: "b", monthly: 199 },
    { key: "c", monthly: 249 },
  ],
  status: "running",
  winner: null,
};

describe("price experiments (D174)", () => {
  it("take 2–4 distinct whole prices, the first the control", () => {
    expect(parseVariants(["149", 199, "249"])).toEqual(experiment.variants);
    expect(parseVariants([149])).toBeNull();
    expect(parseVariants([149, 149])).toBeNull();
    expect(parseVariants([149, 199.5])).toBeNull();
    expect(parseVariants([149, 0])).toBeNull();
    expect(parseVariants([1, 2, 3, 4, 5])).toBeNull();
  });

  it("keep each visitor in one group, and split visitors about evenly", () => {
    const counts = { a: 0, b: 0, c: 0 } as Record<string, number>;
    for (let i = 0; i < 3000; i++) {
      const subject = `v:${i.toString(16).padStart(8, "0")}`;
      const first = assignVariant(experiment, subject);
      expect(assignVariant(experiment, subject)).toEqual(first);
      counts[first.key] += 1;
    }
    for (const n of Object.values(counts)) {
      expect(n).toBeGreaterThan(850);
      expect(n).toBeLessThan(1150);
    }
  });

  it("show a visitor their group's price, yearly at 10 × monthly", () => {
    const view = priceView(PLAN_PRICES, [experiment], "u:someone");
    expect(view.experiment?.plan).toBe("plus");
    const monthly = view.prices.plus.month.amount;
    expect([149, 199, 249]).toContain(monthly);
    expect(view.prices.plus.year.amount).toBe(monthly * 10);
    // Other plans keep their prices; no subject or none running: nothing.
    expect(view.prices.pro).toEqual(PLAN_PRICES.pro);
    expect(priceView(PLAN_PRICES, [experiment], null).experiment).toBeNull();
    expect(
      priceView(PLAN_PRICES, [{ ...experiment, status: "ended" }], "u:x")
        .experiment,
    ).toBeNull();
  });

  it("apply an admin's price over the code's", () => {
    const prices = effectivePrices(PLAN_PRICES, [
      { plan: "plus", monthly: 199 },
      { plan: "nonsense", monthly: 1 },
    ]);
    expect(prices.plus.month.amount).toBe(199);
    expect(prices.plus.year.amount).toBe(1990);
    expect(prices.pro).toEqual(PLAN_PRICES.pro);
  });

  it("read stored rows safely", () => {
    expect(
      parseExperiment({ ...experiment, variants: experiment.variants }),
    ).toEqual(experiment);
    expect(
      parseExperiment({ ...experiment, plan: "gold", variants: [] }),
    ).toBeNull();
    expect(parseExperiment({ ...experiment, variants: "x" })).toBeNull();
  });

  it("count each group's funnel by distinct people, conversions for the plan only", () => {
    const stats = variantStats(experiment, [
      { variant: "a", subject: "v:1", step: "pricing_view", plan: null },
      { variant: "a", subject: "v:1", step: "pricing_view", plan: null },
      { variant: "a", subject: "v:2", step: "pricing_view", plan: null },
      { variant: "a", subject: "v:1", step: "subscribe_click", plan: "plus" },
      { variant: "a", subject: "u:1", step: "waitlist_join", plan: "plus" },
      // Another plan's click says nothing about Plus's price.
      { variant: "a", subject: "v:2", step: "subscribe_click", plan: "pro" },
      { variant: "b", subject: "v:3", step: "pricing_view", plan: null },
    ]);
    expect(stats[0]).toMatchObject({
      visitors: 3,
      views: 3,
      subscribers: 1,
      waitlist: 1,
    });
    expect(stats[0].waitlistRate).toBeCloseTo(1 / 3);
    expect(stats[1]).toMatchObject({ visitors: 1, waitlist: 0 });
    expect(stats[2].visitors).toBe(0);
  });

  it("test two rates with a two-proportion z-test", () => {
    // 10% vs 15% of 1,000 each: z ≈ 3.4, p ≈ 0.0007.
    expect(
      twoProportionP({ n: 1000, x: 100 }, { n: 1000, x: 150 }),
    ).toBeCloseTo(0.0007, 3);
    // Same rate: p = 1.
    expect(twoProportionP({ n: 200, x: 20 }, { n: 200, x: 20 })).toBeCloseTo(1);
    expect(twoProportionP({ n: 0, x: 0 }, { n: 10, x: 1 })).toBeNull();
    expect(twoProportionP({ n: 10, x: 0 }, { n: 10, x: 0 })).toBeNull();
  });

  it("read a result plainly, and suggest the most revenue a visitor", () => {
    const stat = (
      key: string,
      monthly: number,
      visitors: number,
      waitlist: number,
    ): VariantStats => ({
      key,
      monthly,
      visitors,
      views: visitors,
      subscribers: waitlist,
      waitlist,
      subscribeRate: waitlist / visitors,
      waitlistRate: waitlist / visitors,
    });
    const a = stat("a", 149, 1000, 100);
    expect(verdict(a, stat("b", 199, 50, 5))).toEqual({
      kind: "too-early",
      needed: 50,
    });
    expect(verdict(a, stat("b", 199, 1000, 95)).kind).toBe("no-difference");
    expect(verdict(a, stat("b", 199, 1000, 60))).toMatchObject({
      kind: "significant",
      better: "a",
    });
    // 199 × 9% = 17.9 beats 149 × 10% = 14.9 a visitor.
    const b = stat("b", 199, 1000, 90);
    expect(revenuePerVisitor(b)).toBeCloseTo(17.91);
    expect(suggestedWinner([a, b])).toBe("b");
    expect(suggestedWinner([])).toBeNull();
  });
});

describe("the Van Westendorp survey (D174)", () => {
  it("takes four whole prices in order", () => {
    expect(
      cleanPriceAnswers({
        tooExpensive: "400",
        expensive: 200,
        bargain: 90,
        tooCheap: 30,
      }),
    ).toEqual({ tooExpensive: 400, expensive: 200, bargain: 90, tooCheap: 30 });
    // Out of order, missing, or too high.
    expect(
      cleanPriceAnswers({
        tooExpensive: 100,
        expensive: 200,
        bargain: 90,
        tooCheap: 30,
      }),
    ).toBeNull();
    expect(cleanPriceAnswers({ tooExpensive: 100 })).toBeNull();
    expect(
      cleanPriceAnswers({
        tooExpensive: 9999,
        expensive: 200,
        bargain: 90,
        tooCheap: 30,
      }),
    ).toBeNull();
    expect(
      cleanPriceAnswers({
        tooExpensive: 50,
        expensive: 50,
        bargain: 50,
        tooCheap: 50,
      }),
    ).toBeNull();
  });

  it("draws the four curves and finds the range", () => {
    // Answers spread like real ones: each curve overlaps the next.
    const answers: PriceAnswers[] = Array.from({ length: 20 }, (_, i) => ({
      tooCheap: 20 + 10 * i,
      bargain: 60 + 15 * i,
      expensive: 120 + 20 * i,
      tooExpensive: 180 + 25 * i,
    }));
    const points = priceCurves(answers, 300);
    expect(points[0]).toMatchObject({
      tooCheap: 1,
      bargain: 1,
      expensive: 0,
      tooExpensive: 0,
    });
    expect(points.at(-1)).toMatchObject({
      tooCheap: 0,
      bargain: 0,
      expensive: 1,
      tooExpensive: 1,
    });
    const { low, optimal, indifference, high } = priceRange(points);
    for (const value of [low, optimal, indifference, high]) {
      expect(value).not.toBeNull();
    }
    expect(low!).toBeLessThanOrEqual(optimal!);
    expect(optimal!).toBeLessThanOrEqual(high!);
    expect(indifference!).toBeGreaterThan(low!);
    expect(indifference!).toBeLessThan(high!);
    expect(low!).toBeLessThan(high!);
    expect(priceCurves([])).toEqual([]);
  });
});
