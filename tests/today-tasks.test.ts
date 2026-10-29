import { describe, expect, it } from "vitest";
import { settleWeek, type CycleDay } from "@/lib/cycle";
import { createProgress, withDay, type Progress } from "@/lib/progress";
import { todayTasks } from "@/lib/today-tasks";

const TODAY = "2026-10-29";
const YESTERDAY = "2026-10-28";
const titles: Record<string, string> = { sintel: "Sintel", cosmos: "Cosmos" };
const options = { titleOf: (id: string) => titles[id] };

/** Progress with the given days done on the given dates. */
function progressWith(
  videoId: string,
  days: Partial<Record<CycleDay, string>>,
  scores: { 1?: number; 7?: number } = {},
): Progress {
  let progress = createProgress(videoId, "2026-10-20");
  for (const [key, date] of Object.entries(days)) {
    const day = Number(key) as CycleDay;
    progress = withDay(progress, day, {
      done: true,
      date,
      ...(day === 1 && { score: scores[1] ?? 0.5 }),
      ...(day === 7 && { score: scores[7] ?? 0.5 }),
    });
  }
  return progress;
}

const fullWeek = (day7Date: string, day7Score: number) =>
  settleWeek(
    progressWith(
      "sintel",
      {
        1: "2026-10-20",
        2: "2026-10-21",
        3: "2026-10-22",
        4: "2026-10-23",
        5: "2026-10-24",
        6: "2026-10-25",
        7: day7Date,
      },
      { 7: day7Score },
    ),
  );

describe("todayTasks", () => {
  it("offers the next day once the previous one was done on an earlier day", () => {
    expect(
      todayTasks([progressWith("sintel", { 1: YESTERDAY })], TODAY, options),
    ).toEqual([
      {
        videoId: "sintel",
        title: "Sintel",
        week: 1,
        day: 2,
        status: "available",
      },
    ]);
  });

  it("marks today's finished day done, with what opens tomorrow", () => {
    expect(
      todayTasks(
        [progressWith("sintel", { 1: YESTERDAY, 2: TODAY })],
        TODAY,
        options,
      ),
    ).toEqual([
      {
        videoId: "sintel",
        title: "Sintel",
        week: 1,
        day: 2,
        status: "done",
        tomorrow: { day: 3 },
      },
    ]);
  });

  it("in test mode, offers the next day right away", () => {
    const [task] = todayTasks([progressWith("sintel", { 1: TODAY })], TODAY, {
      ...options,
      ignoreDates: true,
    });
    expect(task).toMatchObject({ day: 2, status: "available" });
  });

  it("a week to repeat: done today until tomorrow, then a new week to start", () => {
    const repeat = fullWeek(TODAY, 0.5);
    expect(repeat.status).toBe("repeat");
    expect(todayTasks([repeat], TODAY, options)).toEqual([
      {
        videoId: "sintel",
        title: "Sintel",
        week: 1,
        day: 7,
        status: "done",
        tomorrow: { week: 2 },
      },
    ]);
    expect(todayTasks([repeat], "2026-10-30", options)).toEqual([
      {
        videoId: "sintel",
        title: "Sintel",
        week: 2,
        day: 1,
        status: "available",
        newWeek: true,
      },
    ]);
  });

  it("leaves out passed videos, drafts, and unknown videos", () => {
    const passed = fullWeek(TODAY, 0.9);
    expect(passed.status).toBe("passed");
    expect(
      todayTasks(
        [passed, progressWith("draft-video", {}), progressWith("gone", {})],
        TODAY,
        options,
      ),
    ).toEqual([]);
  });

  it("lists what can be done first, then what's done, each by title", () => {
    const tasks = todayTasks(
      [
        progressWith("sintel", { 1: TODAY }),
        progressWith("cosmos", { 1: TODAY }),
        progressWith("sintel", {}),
      ].map((p, i) => (i === 2 ? { ...p, videoId: "cosmos" } : p)),
      TODAY,
      options,
    );
    expect(tasks.map((t) => [t.title, t.status])).toEqual([
      ["Cosmos", "available"],
      ["Cosmos", "done"],
      ["Sintel", "done"],
    ]);
  });
});
