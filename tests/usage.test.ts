import { describe, expect, it } from "vitest";
import { countChars, DAILY_LIMITS, usageDay } from "@/lib/usage";

describe("usage", () => {
  it("rolls the day over at midnight in Taiwan, not UTC", () => {
    // 15:59 UTC is 23:59 in Taipei (UTC+8); 16:00 UTC is the next day.
    expect(usageDay(new Date("2026-11-03T15:59:00Z"))).toBe("2026-11-03");
    expect(usageDay(new Date("2026-11-03T16:00:00Z"))).toBe("2026-11-04");
  });

  it("counts code points, so each Chinese character or emoji is one", () => {
    expect(countChars(["Hello", "你好", "👋"])).toBe(8);
    expect(countChars([])).toBe(0);
  });

  it("limits speech in characters and language work in estimated cost", () => {
    // 16,000 characters a day stays within Azure F0's 500,000 a month;
    // US$0.50 a day in micro-dollars.
    expect(DAILY_LIMITS).toEqual({ speech: 16_000, cost: 500_000 });
    expect(DAILY_LIMITS.speech * 31).toBeLessThanOrEqual(500_000);
  });
});
