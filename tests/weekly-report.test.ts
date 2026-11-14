import { describe, expect, it } from "vitest";
import type { Activity } from "@/lib/activity";
import type { Progress } from "@/lib/progress";
import type { ReviewWord } from "@/lib/review";
import { WEEKLY_REPORT, weeklyReport } from "@/lib/weekly-report";

// 2026-11-23 is a Monday; last week is 11-16 to 11-22.
const MONDAY = "2026-11-23";

const day = (seconds = 0, tasks: Activity["days"][string] = undefined) => ({
  official: Boolean(tasks?.official),
  retries: [],
  ...(tasks?.tasks && { tasks: tasks.tasks }),
  ...(seconds > 0 && { time: { phone: { sintel: seconds } } }),
});

const review = (due: string, stage = 0): ReviewWord => ({
  en: "The dragon flew away.",
  zh: "龍飛走了。",
  videoId: "sintel",
  i: 0,
  stage,
  due,
  at: `${due}T01:00:00.000Z`,
});

function progress(day1: number, day7: number | null): Progress {
  return {
    videoId: "sintel",
    week: 1,
    startedAt: "2026-11-16",
    days: {
      1: {
        done: true,
        date: "2026-11-16",
        score: day1,
        weightedScore: day1,
      },
      ...(day7 !== null && {
        7: { done: true, date: "2026-11-22", score: day7, weightedScore: day7 },
      }),
    },
    status: "in-progress",
    history: [],
  } as Progress;
}

describe("weeklyReport", () => {
  const activity: Activity = {
    days: {
      "2026-11-16": day(600, {
        official: true,
        retries: [],
        tasks: [{ videoId: "sintel", week: 1, day: 1 }],
      }),
      "2026-11-17": day(300),
      "2026-11-18": day(90),
      "2026-11-22": day(0, {
        official: true,
        retries: [],
        tasks: [{ videoId: "sintel", week: 1, day: 7 }],
      }),
      "2026-11-23": day(1200),
    },
    review: {
      dragon: review("2026-11-17"),
      flew: review("2026-11-23"),
      // Missed the week before: not last week's.
      away: review("2026-11-10"),
      // Reviewed since (stage 1): no longer a fresh miss.
      sky: review("2026-11-20", 1),
    },
  };

  it("sums up last week: time, days, tasks, accuracy, misheard words", () => {
    expect(weeklyReport([progress(0.6, 0.8)], activity, MONDAY)).toEqual({
      from: "2026-11-16",
      to: "2026-11-22",
      week: MONDAY,
      minutes: 17,
      days: 4,
      tasks: 2,
      accuracy: 0.7,
      previousAccuracy: null,
      words: ["flew", "dragon"],
      suggestion: "review",
    });
  });

  it("shows from Monday for a few days only", () => {
    expect(WEEKLY_REPORT.showDays).toBe(3);
    expect(weeklyReport([], activity, "2026-11-25")).not.toBeNull();
    expect(weeklyReport([], activity, "2026-11-26")).toBeNull();
    expect(weeklyReport([], activity, "2026-11-22")).toBeNull();
  });

  it("is null with no practice last week or the week before", () => {
    expect(weeklyReport([], { days: {} }, MONDAY)).toBeNull();
  });

  it("asks to come back after a week off", () => {
    const log: Activity = { days: { "2026-11-18": day(300) } };
    const report = weeklyReport([], log, "2026-11-30");
    expect(report).toMatchObject({ days: 0, minutes: 0, tasks: 0 });
    expect(report?.suggestion).toBe("comeBack");
  });

  it("suggests slowing down when accuracy dropped", () => {
    const log: Activity = {
      days: {
        "2026-11-09": day(60, {
          official: true,
          retries: [],
          tasks: [{ videoId: "sintel", week: 1, day: 1 }],
        }),
      },
    };
    const before = {
      ...progress(0.9, null),
      days: {
        1: {
          done: true,
          date: "2026-11-09",
          score: 0.9,
          weightedScore: 0.9,
        },
      },
      history: [],
    } as Progress;
    const after: Progress = { ...progress(0.7, null), videoId: "other" };
    const report = weeklyReport([before, after], log, MONDAY);
    expect(report).toMatchObject({ accuracy: 0.7, previousAccuracy: 0.9 });
    expect(report?.suggestion).toBe("slowDown");
  });

  it("suggests more days, levelling up, or keeping going", () => {
    const steady = (dates: string[]): Activity => ({
      days: Object.fromEntries(dates.map((d) => [d, day(120)])),
    });
    expect(
      weeklyReport([], steady(["2026-11-16", "2026-11-18"]), MONDAY)
        ?.suggestion,
    ).toBe("moreDays");
    const four = steady([
      "2026-11-16",
      "2026-11-17",
      "2026-11-18",
      "2026-11-19",
    ]);
    expect(weeklyReport([], four, MONDAY)?.suggestion).toBe("keepGoing");
    expect(weeklyReport([progress(0.95, 0.95)], four, MONDAY)?.suggestion).toBe(
      "levelUp",
    );
  });
});
