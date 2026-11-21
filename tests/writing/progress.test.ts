import { describe, expect, it } from "vitest";
import {
  essayPercent,
  mergeWritingProgress,
  newWritingProgress,
  parseWritingProgress,
  passes,
  settleWritingWeek,
  startWritingWeek,
  writingLock,
  writingStatuses,
  type WritingProgress,
} from "@/lib/writing/progress";

const self = (percent: number) => ({
  criteria: [],
  percent,
  weak: [],
});
const essayDay = (date: string, percent: number) => ({
  done: true,
  date,
  essay: "My essay.",
  self: self(percent),
});
const drillDay = (date: string) => ({ done: true, date, drills: [] });

function week(days: WritingProgress["days"]): WritingProgress {
  return { ...newWritingProgress("p", "2026-11-01"), days };
}

describe("the writing week unlocks like listening (D187)", () => {
  it("opens only Day 1 at first", () => {
    expect(writingStatuses(null, "2026-11-01")).toEqual([
      "today",
      "locked",
      "locked",
      "locked",
      "locked",
      "locked",
      "locked",
    ]);
  });

  it("opens the next day on a later calendar day", () => {
    const p = week({ 1: essayDay("2026-11-01", 50) });
    expect(writingLock(p, 2, "2026-11-01")).toBe("tomorrow");
    expect(writingLock(p, 2, "2026-11-02")).toBeNull();
    expect(writingLock(p, 3, "2026-11-02")).toBe("previous");
    // The test mode skips the date rule.
    expect(writingLock(p, 2, "2026-11-01", { ignoreDates: true })).toBeNull();
  });

  it("keeps done days open and closes the rest once the week is settled", () => {
    const p = settleWritingWeek(
      week({
        1: essayDay("2026-11-01", 50),
        2: drillDay("2026-11-02"),
        3: drillDay("2026-11-03"),
        4: drillDay("2026-11-04"),
        5: drillDay("2026-11-05"),
        6: drillDay("2026-11-06"),
        7: essayDay("2026-11-07", 70),
      }),
    );
    expect(p.status).toBe("passed");
    expect(writingLock(p, 3, "2026-11-08")).toBeNull();
  });
});

describe("pass rules (D187)", () => {
  it("by default, Day 7 must beat Day 1", () => {
    expect(passes({ kind: "beat" }, 50, 55)).toBe(true);
    expect(passes({ kind: "beat" }, 50, 50)).toBe(false);
    expect(passes({ kind: "beat" }, 100, 100)).toBe(true);
    expect(passes({ kind: "beat" }, null, 80)).toBe(false);
  });

  it("or reach a chosen score", () => {
    expect(passes({ kind: "target", percent: 70 }, 90, 70)).toBe(true);
    expect(passes({ kind: "target", percent: 70 }, 10, 69)).toBe(false);
  });

  it("settles into history, and another week starts empty", () => {
    const done = settleWritingWeek(
      week({ 1: essayDay("2026-11-01", 60), 7: essayDay("2026-11-07", 55) }),
    );
    expect(done.status).toBe("repeat");
    expect(done.history).toEqual([
      { week: 1, startedAt: "2026-11-01", day1: 60, day7: 55, passed: false },
    ]);
    const next = startWritingWeek(done, "2026-11-08");
    expect(next).toMatchObject({ week: 2, status: "in-progress", days: {} });
    expect(next.history).toHaveLength(1);
  });

  it("scores declined feedback as nothing", () => {
    expect(
      essayPercent({
        done: true,
        essay: "",
        feedback: {
          rubric: "general",
          criteria: [],
          percent: 0,
          issues: [],
          more: [],
          strengths: [],
          summary: "",
          declined: "ghostwrite",
        },
      }),
    ).toBeNull();
  });
});

describe("two devices (D187)", () => {
  it("keeps each day done on either copy", () => {
    const a = {
      ...week({ 1: essayDay("2026-11-01", 50) }),
      updatedAt: "2026-11-01T01:00:00Z",
    };
    const b = {
      ...week({ 1: essayDay("2026-11-01", 50), 2: drillDay("2026-11-02") }),
      updatedAt: "2026-11-02T01:00:00Z",
    };
    const merged = mergeWritingProgress(a, b);
    expect(merged.days[2]?.done).toBe(true);
    expect(mergeWritingProgress(b, a).days[2]?.done).toBe(true);
  });

  it("prefers the later week", () => {
    const old = week({ 1: essayDay("2026-11-01", 50) });
    const later = { ...newWritingProgress("p", "2026-11-09"), week: 2 };
    expect(mergeWritingProgress(old, later).week).toBe(2);
  });

  it("ignores what isn't progress", () => {
    expect(parseWritingProgress({ promptId: 3 })).toBeNull();
    expect(parseWritingProgress(null)).toBeNull();
    expect(
      parseWritingProgress(newWritingProgress("p", "2026-11-01"))?.promptId,
    ).toBe("p");
  });
});
