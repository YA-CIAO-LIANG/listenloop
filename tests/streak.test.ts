import { describe, expect, it } from "vitest";
import type { Activity } from "@/lib/activity";
import {
  STREAK_FREEZE,
  daysBetween,
  practiceDays,
  recentFreeze,
  streakStatus,
  weekStart,
} from "@/lib/streak";

// 2026-11-16 and 2026-11-23 are Mondays.
describe("weekStart", () => {
  it("is the Monday of the date's week", () => {
    expect(weekStart("2026-11-16")).toBe("2026-11-16");
    expect(weekStart("2026-11-19")).toBe("2026-11-16");
    expect(weekStart("2026-11-22")).toBe("2026-11-16");
    expect(weekStart("2027-01-01")).toBe("2026-12-28");
  });

  it("counts days between dates across months", () => {
    expect(daysBetween("2026-11-30", "2026-12-02")).toBe(2);
  });
});

describe("streakStatus", () => {
  it("counts a plain run, and has this week's freeze left", () => {
    expect(
      streakStatus(["2026-11-16", "2026-11-17", "2026-11-18"], "2026-11-18"),
    ).toEqual({ current: 3, longest: 3, freezesLeft: 1, frozen: [] });
  });

  it("covers one missed day with the week's freeze (not counted)", () => {
    const status = streakStatus(
      ["2026-11-16", "2026-11-17", "2026-11-19"],
      "2026-11-19",
    );
    expect(status).toEqual({
      current: 3,
      longest: 3,
      freezesLeft: 0,
      frozen: ["2026-11-18"],
    });
  });

  it("keeps the streak alive today after missing only yesterday", () => {
    const status = streakStatus(["2026-11-16", "2026-11-17"], "2026-11-19");
    expect(status.current).toBe(2);
    expect(status.frozen).toEqual(["2026-11-18"]);
    expect(status.freezesLeft).toBe(0);
  });

  it("never bridges two missed days in a row", () => {
    expect(
      streakStatus(["2026-11-16", "2026-11-19"], "2026-11-19"),
    ).toMatchObject({ current: 1, longest: 1, frozen: [] });
    expect(streakStatus(["2026-11-16"], "2026-11-19").current).toBe(0);
  });

  it("allows one freeze a week; a second gap in the same week breaks it", () => {
    const status = streakStatus(
      ["2026-11-16", "2026-11-18", "2026-11-20", "2026-11-21"],
      "2026-11-21",
    );
    expect(status).toMatchObject({ current: 2, longest: 2, frozen: [] });
  });

  it("gives a new freeze each Monday", () => {
    const status = streakStatus(
      ["2026-11-20", "2026-11-22", "2026-11-23", "2026-11-25"],
      "2026-11-25",
    );
    // 11-21 is covered by last week's freeze, 11-24 by this week's.
    expect(status).toEqual({
      current: 4,
      longest: 4,
      freezesLeft: 0,
      frozen: ["2026-11-21", "2026-11-24"],
    });
  });

  it("doesn't cover days before the feature shipped", () => {
    expect(
      streakStatus(["2026-11-05", "2026-11-07"], "2026-11-07").current,
    ).toBe(1);
    expect(STREAK_FREEZE.since).toBe("2026-11-09");
  });

  it("ignores practice dated after today", () => {
    expect(streakStatus(["2026-11-16", "2026-11-30"], "2026-11-16")).toEqual({
      current: 1,
      longest: 1,
      freezesLeft: 1,
      frozen: [],
    });
  });

  it("forgets the frozen days once the streak breaks", () => {
    const status = streakStatus(
      ["2026-11-16", "2026-11-18", "2026-11-19"],
      "2026-11-23",
    );
    expect(status).toMatchObject({ current: 0, longest: 3, frozen: [] });
  });
});

describe("recentFreeze", () => {
  it("names the latest covered day while it's recent", () => {
    const status = streakStatus(["2026-11-16", "2026-11-18"], "2026-11-18");
    expect(recentFreeze(status, "2026-11-18")).toBe("2026-11-17");
    expect(recentFreeze({ ...status }, "2026-11-30")).toBeNull();
    expect(
      recentFreeze(streakStatus(["2026-11-18"], "2026-11-18"), "2026-11-18"),
    ).toBeNull();
  });
});

describe("practiceDays", () => {
  it("counts official tasks and counted time, not empty days", () => {
    const activity: Activity = {
      days: {
        "2026-11-16": { official: true, retries: [] },
        "2026-11-17": { official: false, retries: [], time: { a: { x: 30 } } },
        "2026-11-18": { official: false, retries: ["sintel"] },
      },
    };
    expect([...practiceDays(activity, [])].sort()).toEqual([
      "2026-11-16",
      "2026-11-17",
    ]);
  });
});
