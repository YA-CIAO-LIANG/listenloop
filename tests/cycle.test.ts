import { describe, expect, it } from "vitest";
import {
  PASS_THRESHOLD,
  canOpenDay,
  canStartNextWeek,
  currentDay,
  dayStatuses,
  lastDoneDay,
  lockReason,
  isPassingScore,
  settleWeek,
  startNextWeek,
  taskForDay,
  weekComparison,
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

describe("lockReason", () => {
  const today = "2026-10-26"; // doneThrough(2) finished Day 2 on 10-25

  it("opens Day 1 without progress and locks the rest", () => {
    expect(lockReason(null, 1, today)).toBeNull();
    expect(lockReason(null, 2, today)).toBe("previous");
  });

  it("explains a missing previous day", () => {
    expect(lockReason(doneThrough(1), 3, today)).toBe("previous");
  });

  it("opens the next day on a later calendar day only", () => {
    const progress = doneThrough(2);
    expect(lockReason(progress, 3, today)).toBeNull();
    expect(lockReason(progress, 3, "2026-10-25")).toBe("tomorrow");
    expect(
      lockReason(progress, 3, "2026-10-25", { ignoreDates: true }),
    ).toBeNull();
  });

  it("never locks a done day", () => {
    expect(lockReason(doneThrough(2), 2, "2026-10-01")).toBeNull();
  });

  it("locks unfinished days once the week is settled", () => {
    const settled = settleWeek(doneThrough(7));
    expect(lockReason({ ...settled, days: {} }, 1, today)).toBe("weekClosed");
  });
});

describe("currentDay and lastDoneDay", () => {
  it("finds the day to practice now", () => {
    expect(currentDay(dayStatuses(null, START))).toBe(1);
    expect(currentDay(dayStatuses(doneThrough(2), "2026-10-26"))).toBe(3);
  });

  it("is null once today's task is done", () => {
    expect(currentDay(dayStatuses(doneThrough(2), "2026-10-25"))).toBeNull();
  });

  it("finds the latest finished day", () => {
    expect(lastDoneDay(null)).toBeNull();
    expect(lastDoneDay(doneThrough(3))).toBe(3);
  });
});

describe("canStartNextWeek", () => {
  // doneThrough(7) finishes Day 7 on 2026-10-30 with 0.7 → repeat.
  const repeat = settleWeek(doneThrough(7));

  it("waits until the day after Day 7", () => {
    expect(repeat.status).toBe("repeat");
    expect(canStartNextWeek(repeat, "2026-10-30")).toBe(false);
    expect(canStartNextWeek(repeat, "2026-10-31")).toBe(true);
  });

  it("starts right away in test mode", () => {
    expect(canStartNextWeek(repeat, "2026-10-30", { ignoreDates: true })).toBe(
      true,
    );
  });

  it("is only for weeks that need repeating", () => {
    expect(canStartNextWeek(doneThrough(7), "2026-11-30")).toBe(false);
    expect(canStartNextWeek(null, "2026-11-30")).toBe(false);
  });
});

describe("weekComparison", () => {
  const sentences = [
    { i: 0, start: 0, end: 1, en: "Go home.", zh: "回家。" },
    { i: 1, start: 1, end: 2, en: "We moved.", zh: "我們搬家了。" },
  ];

  it("compares Day 1 and Day 7 overall and per sentence", () => {
    let progress = createProgress("voa-001", START);
    progress = withDay(progress, 1, {
      done: true,
      score: 0.5,
      answers: ["go home", "we"],
    });
    progress = withDay(progress, 7, {
      done: true,
      score: 1,
      answers: ["go home", "we moved"],
    });
    expect(weekComparison(sentences, progress)).toEqual({
      day1: 0.5,
      day7: 1,
      sentences: [
        { day1: 1, day7: 1 },
        { day1: 0.5, day7: 1 },
      ],
    });
  });

  it("is null until both days are scored", () => {
    expect(weekComparison(sentences, doneThrough(6))).toBeNull();
  });
});
