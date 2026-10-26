import { isLaterDay, type LocalDate } from "./dates";
import type { Progress } from "./progress";

/** Day 7 accuracy at or above this passes the week (see CLAUDE.md 週結算). */
export const PASS_THRESHOLD = 0.8;

export const DAYS_PER_CYCLE = 7;

export type CycleDay = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const CYCLE_DAYS: readonly CycleDay[] = [1, 2, 3, 4, 5, 6, 7];

export type DayTask = "dictation" | "shadowing" | "redictation";

export type DayStatus = "locked" | "available" | "today" | "done";

/** Score is a ratio between 0 and 1. */
export function isPassingScore(score: number): boolean {
  return score >= PASS_THRESHOLD;
}

/** Day 1 is dictation, Days 2–6 are shadowing, Day 7 is re-dictation. */
export function taskForDay(day: CycleDay): DayTask {
  if (day === 1) return "dictation";
  if (day === DAYS_PER_CYCLE) return "redictation";
  return "shadowing";
}

type StatusOptions = {
  /** Skip the "different calendar day" rule (NEXT_PUBLIC_DEV_TEST_MODE). */
  ignoreDates?: boolean;
};

/**
 * Status of each day for DayTracker and page guards. A day opens ("today")
 * once the previous day is done on an earlier calendar day; Day 1 is always
 * open. Without progress, only Day 1 is open.
 */
export function dayStatuses(
  progress: Progress | null,
  today: LocalDate,
  { ignoreDates = false }: StatusOptions = {},
): DayStatus[] {
  return CYCLE_DAYS.map((day) => {
    if (progress?.days[day]?.done) return "done";
    if (progress && progress.status !== "in-progress") return "locked";
    if (day === 1) return "today";

    const previous = progress?.days[(day - 1) as CycleDay];
    if (!previous?.done || !previous.date) return "locked";
    if (!ignoreDates && !isLaterDay(today, previous.date)) return "locked";
    return "today";
  });
}

/** Whether the user may open a day's practice page (done days stay viewable). */
export function canOpenDay(
  progress: Progress | null,
  day: CycleDay,
  today: LocalDate,
  options?: StatusOptions,
): boolean {
  return dayStatuses(progress, today, options)[day - 1] !== "locked";
}

/**
 * Closes the week after Day 7: passed at PASS_THRESHOLD or above, otherwise
 * "repeat". The week's scores are appended to history.
 */
export function settleWeek(progress: Progress): Progress {
  if (progress.status !== "in-progress") return progress;

  const day1Score = progress.days[1]?.score;
  const day7 = progress.days[7];
  if (!day7?.done || day7.score === undefined || day1Score === undefined) {
    throw new Error("Cannot settle a week before Day 1 and Day 7 are scored");
  }

  const passed = isPassingScore(day7.score);
  return {
    ...progress,
    status: passed ? "passed" : "repeat",
    history: [
      ...progress.history,
      {
        week: progress.week,
        startedAt: progress.startedAt,
        day1Score,
        day7Score: day7.score,
        passed,
      },
    ],
  };
}

/** Starts the same video again after a "repeat" result; history is kept. */
export function startNextWeek(progress: Progress, today: LocalDate): Progress {
  if (progress.status !== "repeat") {
    throw new Error("Only a week that needs repeating can start again");
  }
  return {
    ...progress,
    week: progress.week + 1,
    startedAt: today,
    days: {},
    status: "in-progress",
  };
}
