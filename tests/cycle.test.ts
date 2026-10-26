import { describe, expect, it } from "vitest";
import {
  PASS_THRESHOLD,
  canOpenDay,
  dayStatuses,
  isPassingScore,
  settleWeek,
  startNextWeek,
  taskForDay,
  type CycleDay,
} from "@/lib/cycle";
import { createProgress, withDay, type Progress } from "@/lib/progress";

const START = "2026-10-24";

/** Progress with days 1..n done on consecutive calendar days from START. */
function doneThrough(n: number): Progress {
  let progress = createProgress("voa-001", START);
  for (let day = 1; day <= n; day++) {
    const date = `2026-10-${String(23 + day).padStart(2, "0")}`;
    progress = withDay(progress, day as CycleDay, {
      done: true,
      date,
      ...(day === 1 || day === 7 ? { score: 0.7 } : {}),
    });
  }
  return progress;
}

describe("isPassingScore", () => {
  it("passes at exactly the threshold", () => {
    expect(PASS_THRESHOLD).toBe(0.8);
    expect(isPassingScore(0.8)).toBe(true);
  });

  it.each([
    [1, true],
    [0.86, true],
    [0.79, false],
    [0, false],
  ])("%s → %s", (score, expected) => {
    expect(isPassingScore(score)).toBe(expected);
  });
});

describe("taskForDay", () => {
  it.each<[CycleDay, string]>([
    [1, "dictation"],
    [2, "shadowing"],
    [4, "shadowing"],
    [6, "shadowing"],
    [7, "redictation"],
  ])("day %s → %s", (day, task) => {
    expect(taskForDay(day)).toBe(task);
  });
});

describe("dayStatuses", () => {
  it("opens only Day 1 before any progress", () => {
    expect(dayStatuses(null, START)).toEqual([
      "today",
      "locked",
      "locked",
      "locked",
      "locked",
      "locked",
      "locked",
    ]);
  });

  it("keeps the next day locked on the same calendar day", () => {
    // Day 1 finished on 10-24; it's still 10-24.
    expect(dayStatuses(doneThrough(1), "2026-10-24").slice(0, 3)).toEqual([
      "done",
      "locked",
      "locked",
    ]);
  });

  it("opens the next day on a later calendar day", () => {
    expect(dayStatuses(doneThrough(1), "2026-10-25").slice(0, 3)).toEqual([
      "done",
      "today",
      "locked",
    ]);
  });

  it("opens the next day even after skipping days", () => {
    expect(dayStatuses(doneThrough(2), "2026-11-10")[2]).toBe("today");
  });

  it("requires the previous day to be finished, not just started", () => {
    const progress = withDay(doneThrough(1), 2, {
      done: false,
      sentences: [{ done: true, coverage: 1 }],
    });
    expect(dayStatuses(progress, "2026-12-01").slice(1, 3)).toEqual([
      "today",
      "locked",
    ]);
  });

  it("ignores the date rule in test mode", () => {
    expect(
      dayStatuses(doneThrough(3), "2026-10-26", { ignoreDates: true })[3],
    ).toBe("today");
    expect(dayStatuses(doneThrough(3), "2026-10-26")[3]).toBe("locked");
  });

  it("locks everything left once the week is settled", () => {
    const settled = { ...doneThrough(7), status: "passed" as const };
    expect(dayStatuses(settled, "2026-11-30").every((s) => s === "done")).toBe(
      true,
    );
  });
});

describe("canOpenDay", () => {
  it("allows open and finished days, blocks locked ones", () => {
    const progress = doneThrough(2);
    expect(canOpenDay(progress, 1, "2026-10-25")).toBe(true); // done, viewable
    expect(canOpenDay(progress, 3, "2026-10-25")).toBe(false); // same day as Day 2
    expect(canOpenDay(progress, 3, "2026-10-26")).toBe(true);
    expect(canOpenDay(progress, 3, "2026-10-25", { ignoreDates: true })).toBe(
      true,
    );
  });
});

describe("settleWeek", () => {
  it("passes at 80% on Day 7 and records the week", () => {
    const progress = withDay(doneThrough(7), 7, {
      done: true,
      date: "2026-10-30",
      score: 0.8,
    });
    const settled = settleWeek(progress);
    expect(settled.status).toBe("passed");
    expect(settled.history).toEqual([
      {
        week: 1,
        startedAt: START,
        day1Score: 0.7,
        day7Score: 0.8,
        passed: true,
      },
    ]);
  });

  it("asks to repeat below 80%", () => {
    const settled = settleWeek(doneThrough(7)); // Day 7 score 0.7
    expect(settled.status).toBe("repeat");
    expect(settled.history[0].passed).toBe(false);
  });

  it("does nothing to an already settled week", () => {
    const settled = settleWeek(doneThrough(7));
    expect(settleWeek(settled)).toBe(settled);
  });

  it("refuses to settle before Day 7 is scored", () => {
    expect(() => settleWeek(doneThrough(6))).toThrow();
  });
});

describe("startNextWeek", () => {
  it("restarts the days and keeps history", () => {
    const repeated = settleWeek(doneThrough(7));
    const next = startNextWeek(repeated, "2026-11-01");
    expect(next).toMatchObject({
      week: 2,
      startedAt: "2026-11-01",
      days: {},
      status: "in-progress",
    });
    expect(next.history).toEqual(repeated.history);
    expect(dayStatuses(next, "2026-11-01")[0]).toBe("today");
  });

  it("only applies to a week that needs repeating", () => {
    expect(() => startNextWeek(doneThrough(3), "2026-11-01")).toThrow();
  });
});
