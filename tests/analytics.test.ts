import { describe, expect, it } from "vitest";
import type { Activity } from "@/lib/activity";
import {
  accuracyTrend,
  dailyMinutes,
  dayOneVsSeven,
  distribution,
  lastDays,
  siteActivity,
  streaks,
  topMissedWords,
  type MaterialInfo,
} from "@/lib/analytics";
import { addPracticeTime } from "@/lib/practice-time";
import type { Progress } from "@/lib/progress";

/** The stats page (D75). */
const progress = (over: Partial<Progress>): Progress => ({
  videoId: "sintel",
  week: 1,
  startedAt: "2026-11-01",
  days: {},
  status: "in-progress",
  history: [],
  ...over,
});

const materials = new Map<string, MaterialInfo>([
  [
    "sintel",
    {
      title: "Sintel",
      category: "talks-stories",
      level: "intermediate",
      sentences: ["We moved to the city.", "It was cold."],
    },
  ],
  [
    "p-1",
    { title: "Check-in", category: "travel", level: "beginner", sentences: [] },
  ],
]);

describe("lastDays", () => {
  it("lists days ending today, across months", () => {
    expect(lastDays("2026-11-02", 3)).toEqual([
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
  });
});

describe("dailyMinutes", () => {
  it("adds every device and material for each day", () => {
    let log: Activity = { days: {} };
    log = addPracticeTime(log, "2026-11-08", "phone", "sintel", 300);
    log = addPracticeTime(log, "2026-11-08", "laptop", "p-1", 150);
    expect(dailyMinutes(log, "2026-11-08", 2)).toEqual([
      { date: "2026-11-07", minutes: 0 },
      { date: "2026-11-08", minutes: 8 },
    ]);
  });
});

describe("accuracyTrend", () => {
  it("lists dated Day 1 and Day 7 scores, raw and weighted", () => {
    const p = progress({
      days: {
        1: {
          done: true,
          date: "2026-11-01",
          score: 0.6,
          weightedScore: 0.54,
        },
        7: { done: true, date: "2026-11-07", score: 0.9 },
      },
    });
    expect(accuracyTrend([p], { days: {} })).toEqual([
      {
        date: "2026-11-01",
        videoId: "sintel",
        day: 1,
        raw: 0.6,
        weighted: 0.54,
      },
      {
        date: "2026-11-07",
        videoId: "sintel",
        day: 7,
        raw: 0.9,
        weighted: 0.9,
      },
    ]);
  });

  it("dates earlier weeks by the activity log, once", () => {
    const p = progress({
      week: 2,
      status: "in-progress",
      history: [
        {
          week: 1,
          startedAt: "2026-10-01",
          day1Score: 0.5,
          day7Score: 0.7,
          passed: false,
        },
      ],
    });
    const log: Activity = {
      days: {
        "2026-10-07": {
          official: true,
          retries: [],
          tasks: [{ videoId: "sintel", week: 1, day: 7 }],
        },
      },
    };
    expect(accuracyTrend([p], log)).toEqual([
      {
        date: "2026-10-07",
        videoId: "sintel",
        day: 7,
        raw: 0.7,
        weighted: 0.7,
      },
    ]);
  });
});

describe("dayOneVsSeven", () => {
  it("takes the current week, or the last finished one", () => {
    expect(
      dayOneVsSeven([
        progress({
          days: {
            1: { done: true, score: 0.5 },
            7: { done: true, score: 0.9, weightedScore: 0.81 },
          },
        }),
        progress({
          videoId: "p-1",
          week: 2,
          history: [
            {
              week: 1,
              startedAt: "2026-10-01",
              day1Score: 0.4,
              day7Score: 0.7,
              day7Weighted: 0.63,
              passed: false,
            },
          ],
        }),
      ]),
    ).toEqual([
      { videoId: "sintel", day1: 0.5, day7: 0.81 },
      { videoId: "p-1", day1: 0.4, day7: 0.63 },
    ]);
  });
});

describe("topMissedWords", () => {
  it("counts missed words across days, most first", () => {
    const p = progress({
      days: {
        1: { done: true, score: 0.5, answers: ["we move to city", "it is"] },
        7: { done: true, score: 0.8, answers: ["we move to the city", null] },
      },
    });
    expect(topMissedWords([p], materials)).toEqual([
      { word: "moved", count: 2 },
      { word: "cold", count: 1 },
      { word: "the", count: 1 },
      { word: "was", count: 1 },
    ]);
    expect(topMissedWords([p], materials, 1)).toHaveLength(1);
  });
});

describe("distribution", () => {
  it("counts started materials by category and level", () => {
    const list = [progress({}), progress({ videoId: "p-1" })];
    expect(distribution(list, materials, "level")).toEqual([
      { key: "beginner", count: 1 },
      { key: "intermediate", count: 1 },
    ]);
  });
});

describe("streaks", () => {
  const log: Activity = {
    days: {
      "2026-11-01": { official: true, retries: [] },
      "2026-11-02": { official: true, retries: [] },
      "2026-11-03": { official: true, retries: [] },
      "2026-11-06": { official: true, retries: [] },
      "2026-11-07": {
        official: false,
        retries: [],
        time: { phone: { sintel: 60 } },
      },
    },
  };

  it("counts the run ending today or yesterday, and the longest", () => {
    expect(streaks(log, [], "2026-11-08")).toEqual({ current: 2, longest: 3 });
    expect(streaks(log, [], "2026-11-07")).toEqual({ current: 2, longest: 3 });
    expect(streaks(log, [], "2026-11-10")).toEqual({ current: 0, longest: 3 });
  });
});

describe("siteActivity", () => {
  it("averages minutes over learners active each day, and both accuracies", () => {
    const a = addPracticeTime({ days: {} }, "2026-11-08", "x", "sintel", 600);
    const b = addPracticeTime({ days: {} }, "2026-11-08", "y", "sintel", 1200);
    const stats = siteActivity(
      [a, b],
      [
        progress({
          days: { 1: { done: true, score: 1, weightedScore: 0.9 } },
        }),
      ],
      "2026-11-08",
      2,
    );
    expect(stats.days.at(-1)).toEqual({
      date: "2026-11-08",
      active: 2,
      minutes: 30,
    });
    expect(stats.averageMinutes).toBe(15);
    expect(stats.accuracy).toEqual({ raw: 1, weighted: 0.9, n: 1 });
  });
});
