import { describe, expect, it } from "vitest";
import { emptyActivity, parseActivity, recordTask } from "@/lib/activity";
import type { CycleDay } from "@/lib/cycle";
import { heatLevel, tasksByDate } from "@/lib/practice-calendar";
import { createProgress, withDay, type Progress } from "@/lib/progress";

const task = (videoId: string, day: number, week = 1) => ({
  videoId,
  week,
  day,
});

describe("recordTask", () => {
  it("notes each finished task once, marking the day as practiced", () => {
    let activity = recordTask(emptyActivity(), "2026-10-27", task("sintel", 1));
    expect(recordTask(activity, "2026-10-27", task("sintel", 1))).toBe(
      activity,
    );
    activity = recordTask(activity, "2026-10-27", task("voa-001", 3));
    expect(activity.days["2026-10-27"]).toEqual({
      official: true,
      retries: [],
      tasks: [task("sintel", 1), task("voa-001", 3)],
    });
  });

  it("reads logs saved before tasks were kept, and rejects broken tasks", () => {
    expect(
      parseActivity({
        days: { "2026-10-20": { official: true, retries: [] } },
      }),
    ).not.toBeNull();
    expect(
      parseActivity({
        days: {
          "2026-10-20": {
            official: true,
            retries: [],
            tasks: [{ videoId: "x", week: 1, day: 9 }],
          },
        },
      }),
    ).toBeNull();
  });
});

describe("tasksByDate", () => {
  function progressWith(
    videoId: string,
    week: number,
    days: Partial<Record<CycleDay, string>>,
  ): Progress {
    let progress = { ...createProgress(videoId, "2026-10-01"), week };
    for (const [day, date] of Object.entries(days)) {
      progress = withDay(progress, Number(day) as CycleDay, {
        done: true,
        date,
      });
    }
    return progress;
  }

  it("merges the log with completion dates in progress, without duplicates", () => {
    const activity = recordTask(
      emptyActivity(),
      "2026-10-20",
      task("sintel", 1),
    );
    const byDate = tasksByDate(activity, [
      progressWith("sintel", 1, { 1: "2026-10-20", 2: "2026-10-21" }),
    ]);
    expect(byDate.get("2026-10-20")).toEqual([task("sintel", 1)]);
    expect(byDate.get("2026-10-21")).toEqual([task("sintel", 2)]);
    expect(byDate.has("2026-10-22")).toBe(false);
  });

  it("keeps days of a repeated week that only the log remembers", () => {
    const activity = recordTask(
      emptyActivity(),
      "2026-10-03",
      task("sintel", 3, 1),
    );
    // Week 2 started over: week 1's days are gone from progress.
    const byDate = tasksByDate(activity, [progressWith("sintel", 2, {})]);
    expect(byDate.get("2026-10-03")).toEqual([task("sintel", 3, 1)]);
  });

  it("sorts each day by video, then week and day", () => {
    let activity = recordTask(
      emptyActivity(),
      "2026-10-27",
      task("voa-001", 2),
    );
    activity = recordTask(activity, "2026-10-27", task("sintel", 4));
    activity = recordTask(activity, "2026-10-27", task("sintel", 1, 2));
    expect(tasksByDate(activity, []).get("2026-10-27")).toEqual([
      task("sintel", 4, 1),
      task("sintel", 1, 2),
      task("voa-001", 2),
    ]);
  });
});

describe("heatLevel", () => {
  it("steps 0, 1, 2, 3, then 4 for four or more tasks", () => {
    expect([0, 1, 2, 3, 4, 5, 12].map(heatLevel)).toEqual([
      0, 1, 2, 3, 4, 4, 4,
    ]);
  });
});
