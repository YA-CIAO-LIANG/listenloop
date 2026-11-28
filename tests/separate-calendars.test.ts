import { describe, expect, it } from "vitest";
import type { Activity } from "@/lib/activity";
import { dailyMinutes, streaks } from "@/lib/analytics";
import {
  isListeningTimeId,
  isWritingTimeId,
  practiceMinutes,
} from "@/lib/practice-time";
import { practiceDays, streakStatus } from "@/lib/streak";
import { reportWeek, weeklyReport } from "@/lib/weekly-report";
import {
  writingDailyMinutes,
  writingWeeklyReport,
} from "@/lib/writing/analytics";
import {
  emptyLog,
  writingCalendar,
  writingPracticeDays,
  type WritingLog,
} from "@/lib/writing/log";

/**
 * D214: listening and writing are counted apart. Practice time, streaks,
 * the stats, and the weekly report of one never include the other's.
 */

// 2026-11-23 is a Monday; last week is 11-16 to 11-22.
const MONDAY = "2026-11-23";

/** A day with time on `material` (seconds) and nothing else. */
const timed = (material: string, seconds: number) => ({
  official: false,
  retries: [],
  time: { phone: { [material]: seconds } },
});

/** Listening on 11-16 and 11-17; writing on 11-18 and 11-19. */
const activity: Activity = {
  days: {
    "2026-11-16": timed("sintel", 600),
    "2026-11-17": timed("review", 120),
    "2026-11-18": timed("w-p1", 900),
    "2026-11-19": timed("w-chat", 300),
  },
};

const writingLog = (dates: string[]): WritingLog => ({
  entries: Object.fromEntries(
    dates.map((date, i) => [
      `task:p1:1:${i + 1}`,
      {
        id: `task:p1:1:${i + 1}`,
        kind: "task" as const,
        date,
        promptId: "p1",
        week: 1,
        day: i + 1,
        at: `${date}T10:00:00.000Z`,
      },
    ]),
  ),
});

describe("time ids", () => {
  it("splits listening's materials from writing's", () => {
    expect(isWritingTimeId("w-p1")).toBe(true);
    expect(isWritingTimeId("w-chat")).toBe(true);
    expect(isListeningTimeId("sintel")).toBe(true);
    expect(isListeningTimeId("p-123")).toBe(true);
    expect(isListeningTimeId("review")).toBe(true);
    expect(isListeningTimeId("w-p1")).toBe(false);
  });

  it("never adds the two together on a mixed day", () => {
    const day = {
      official: false,
      retries: [],
      time: { phone: { sintel: 300, "w-p1": 600 } },
    };
    expect(practiceMinutes(day, isListeningTimeId)).toBe(5);
    expect(practiceMinutes(day, isWritingTimeId)).toBe(10);
  });
});

describe("listening's streak and time", () => {
  it("leaves writing's days out", () => {
    expect([...practiceDays(activity, [])].sort()).toEqual([
      "2026-11-16",
      "2026-11-17",
    ]);
  });

  it("is empty after writing only", () => {
    const writingOnly: Activity = {
      days: { "2026-11-18": timed("w-p1", 900) },
    };
    expect(practiceDays(writingOnly, []).size).toBe(0);
    expect(streaks(writingOnly, [], "2026-11-18")).toMatchObject({
      current: 0,
      longest: 0,
    });
  });

  it("charts listening minutes only", () => {
    expect(
      dailyMinutes(activity, "2026-11-19", 4).map((d) => d.minutes),
    ).toEqual([10, 2, 0, 0]);
  });

  it("leaves writing out of the weekly report", () => {
    const report = weeklyReport([], activity, MONDAY);
    expect(report).toMatchObject({ minutes: 12, days: 2, tasks: 0 });
  });

  it("has no listening report after a week of writing only", () => {
    const writingOnly: Activity = {
      days: { "2026-11-18": timed("w-p1", 900) },
    };
    expect(weeklyReport([], writingOnly, MONDAY)).toBeNull();
  });
});

describe("writing's streak and time", () => {
  it("counts writing tasks and writing time, not listening", () => {
    const days = writingCalendar(writingLog(["2026-11-20"]), [], []);
    expect([...writingPracticeDays(days, activity)].sort()).toEqual([
      "2026-11-18",
      "2026-11-19",
      "2026-11-20",
    ]);
    expect(
      streakStatus(writingPracticeDays(days, activity), "2026-11-20"),
    ).toMatchObject({ current: 3, longest: 3 });
  });

  it("is empty after listening only", () => {
    const listeningOnly: Activity = {
      days: { "2026-11-16": timed("sintel", 600) },
    };
    const days = writingCalendar(emptyLog(), [], []);
    expect(writingPracticeDays(days, listeningOnly).size).toBe(0);
  });

  it("charts writing minutes only", () => {
    expect(
      writingDailyMinutes(activity, "2026-11-19", 4).map((d) => d.minutes),
    ).toEqual([0, 0, 15, 5]);
  });

  it("sums up last week's writing on its own", () => {
    const days = writingCalendar(
      writingLog(["2026-11-18", "2026-11-20"]),
      [],
      [],
    );
    expect(
      writingWeeklyReport({ progresses: [], days, activity, today: MONDAY }),
    ).toEqual({
      from: "2026-11-16",
      to: "2026-11-22",
      week: MONDAY,
      minutes: 20,
      days: 3,
      tasks: 2,
      essays: 0,
      drills: 0,
      improvement: null,
    });
  });

  it("has no writing report after listening only, or after Wednesday", () => {
    const listeningOnly: Activity = {
      days: { "2026-11-16": timed("sintel", 600) },
    };
    const none = writingCalendar(emptyLog(), [], []);
    expect(
      writingWeeklyReport({
        progresses: [],
        days: none,
        activity: listeningOnly,
        today: MONDAY,
      }),
    ).toBeNull();
    const days = writingCalendar(writingLog(["2026-11-18"]), [], []);
    expect(
      writingWeeklyReport({
        progresses: [],
        days,
        activity,
        today: "2026-11-26",
      }),
    ).toBeNull();
  });
});

describe("reportWeek", () => {
  it("is last Monday to Sunday, shown Monday to Wednesday", () => {
    expect(reportWeek(MONDAY)).toEqual({
      week: MONDAY,
      from: "2026-11-16",
      to: "2026-11-22",
    });
    expect(reportWeek("2026-11-25")).not.toBeNull();
    expect(reportWeek("2026-11-26")).toBeNull();
  });
});
