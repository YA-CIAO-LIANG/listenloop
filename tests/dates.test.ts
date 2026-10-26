import { describe, expect, it } from "vitest";
import { isLaterDay, isLocalDate, toLocalDate } from "@/lib/dates";

describe("toLocalDate", () => {
  it("uses the device's local calendar day, zero-padded", () => {
    expect(toLocalDate(new Date(2026, 0, 5, 9, 30))).toBe("2026-01-05");
  });

  it("stays on the same local day just before midnight", () => {
    // 23:59 local is still the same day, even if it's tomorrow in UTC.
    expect(toLocalDate(new Date(2026, 9, 24, 23, 59))).toBe("2026-10-24");
    expect(toLocalDate(new Date(2026, 9, 25, 0, 0))).toBe("2026-10-25");
  });
});

describe("isLocalDate", () => {
  it.each(["2026-10-24", "2024-02-29"])("accepts %s", (value) => {
    expect(isLocalDate(value)).toBe(true);
  });

  it.each([
    "2026-1-5",
    "2026-02-30",
    "2025-02-29",
    "2026-13-01",
    "",
    20261024,
    null,
  ])("rejects %j", (value) => {
    expect(isLocalDate(value)).toBe(false);
  });
});

describe("isLaterDay", () => {
  it("compares calendar days, across months and years", () => {
    expect(isLaterDay("2026-10-25", "2026-10-24")).toBe(true);
    expect(isLaterDay("2026-11-01", "2026-10-31")).toBe(true);
    expect(isLaterDay("2027-01-01", "2026-12-31")).toBe(true);
    expect(isLaterDay("2026-10-24", "2026-10-24")).toBe(false);
    expect(isLaterDay("2026-10-23", "2026-10-24")).toBe(false);
  });
});
