import { describe, expect, it } from "vitest";
import {
  cleanReportDetails,
  isReportReason,
  REPORT_LIMITS,
  tallyReasons,
} from "@/lib/moderation";

describe("report input", () => {
  it("accepts only the listed reasons", () => {
    expect(isReportReason("copyright")).toBe(true);
    expect(isReportReason("personal")).toBe(true);
    expect(isReportReason("boring")).toBe(false);
    expect(isReportReason(undefined)).toBe(false);
  });

  it("trims details and rejects ones that are too long or not text", () => {
    expect(cleanReportDetails("  from a textbook  ")).toBe("from a textbook");
    expect(cleanReportDetails(undefined)).toBe("");
    expect(cleanReportDetails("字".repeat(REPORT_LIMITS.details))).toHaveLength(
      REPORT_LIMITS.details,
    );
    expect(cleanReportDetails("字".repeat(REPORT_LIMITS.details + 1))).toBe(
      null,
    );
    expect(cleanReportDetails(42)).toBe(null);
  });
});

describe("tallyReasons", () => {
  it("counts each reason, most reported first, ties in the listed order", () => {
    expect(
      tallyReasons(["other", "spam", "copyright", "spam", "other"]),
    ).toEqual([
      { reason: "spam", count: 2 },
      { reason: "other", count: 2 },
      { reason: "copyright", count: 1 },
    ]);
    expect(tallyReasons([])).toEqual([]);
  });
});
