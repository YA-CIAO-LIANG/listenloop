import { describe, expect, it } from "vitest";
import { niceMax } from "@/components/charts/ColumnChart";

describe("niceMax", () => {
  it("rounds up to a top whose middle line is a whole number", () => {
    // No practice yet (the chart's floor is 1): 2, so the axis reads 2, 1, 0.
    expect(niceMax(1)).toBe(2);
    expect(niceMax(3)).toBe(4);
    expect(niceMax(5)).toBe(6);
    expect(niceMax(9)).toBe(10);
    expect(niceMax(19)).toBe(20);
    expect(niceMax(42)).toBe(50);
    expect(niceMax(120)).toBe(200);
    for (const max of [1, 2, 3, 5, 7, 9]) {
      expect(Number.isInteger(niceMax(max) / 2)).toBe(true);
    }
  });
});
