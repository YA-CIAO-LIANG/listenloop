import { describe, expect, it } from "vitest";
import {
  creditLeftUsd,
  microsToUsd,
  usagePeriodStarts,
} from "@/lib/usage-report";

describe("usage report", () => {
  it("starts the day and month at midnight in Taiwan", () => {
    // 2026-11-30 17:00 UTC is already December 1 in Taipei.
    expect(usagePeriodStarts(new Date("2026-11-30T17:00:00Z"))).toEqual({
      dayStart: "2026-11-30T16:00:00.000Z",
      monthStart: "2026-11-30T16:00:00.000Z",
    });
    expect(usagePeriodStarts(new Date("2026-11-05T03:00:00Z"))).toEqual({
      dayStart: "2026-11-04T16:00:00.000Z",
      monthStart: "2026-10-31T16:00:00.000Z",
    });
  });

  it("estimates the credit left", () => {
    expect(microsToUsd(1_500_000)).toBe(1.5);
    expect(creditLeftUsd(1_500_000)).toBe(98.5);
    expect(creditLeftUsd(200_000_000)).toBe(0);
  });
});
