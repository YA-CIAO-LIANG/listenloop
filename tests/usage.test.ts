import { describe, expect, it } from "vitest";
import {
  countChars,
  DAILY_LIMITS,
  dailyCostLimit,
  DEFAULT_USAGE_SETTINGS,
  nextUsageDay,
  parseUsageSettings,
  usageDay,
  usageMonth,
} from "@/lib/usage";

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
    expect(DAILY_LIMITS).toEqual({ speech: 16_000, cost: 50_000 });
    expect(DAILY_LIMITS.speech * 31).toBeLessThanOrEqual(500_000);
  });
});

describe("usage settings (D77)", () => {
  it("picks the day's cost limit by plan and kind of work", () => {
    const s = DEFAULT_USAGE_SETTINGS;
    expect(dailyCostLimit(s, "admin", "manual")).toBe(1_000_000);
    expect(dailyCostLimit(s, "admin", "batch")).toBe(1_000_000);
    expect(dailyCostLimit(s, "paid", "manual")).toBe(200_000);
    expect(dailyCostLimit(s, "free", "manual")).toBe(50_000);
    expect(s.siteMonthlyMicros).toBe(8_000_000);
  });

  it("reads limits typed in US$, and refuses bad ones", () => {
    const typed = {
      adminManualMicros: "1",
      adminBatchMicros: "1.5",
      paidMicros: "0.2",
      freeMicros: "0.05",
      siteMonthlyMicros: "8",
    };
    expect(parseUsageSettings(typed)).toEqual({
      adminManualMicros: 1_000_000,
      adminBatchMicros: 1_500_000,
      paidMicros: 200_000,
      freeMicros: 50_000,
      siteMonthlyMicros: 8_000_000,
    });
    expect(parseUsageSettings({ ...typed, paidMicros: "-1" })).toBeNull();
    expect(parseUsageSettings({ ...typed, freeMicros: "" })).toBeNull();
    expect(
      parseUsageSettings({ ...typed, siteMonthlyMicros: "101" }),
    ).toBeNull();
  });

  it("knows when Taiwan's day and month roll over", () => {
    expect(nextUsageDay(new Date("2026-11-07T15:59:00Z")).toISOString()).toBe(
      "2026-11-07T16:00:00.000Z",
    );
    expect(
      usageMonth(new Date("2026-11-30T16:30:00Z")).start.toISOString(),
    ).toBe("2026-11-30T16:00:00.000Z");
  });
});
