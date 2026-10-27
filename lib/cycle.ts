import { isLaterDay, type LocalDate } from "./dates";
import type { Progress } from "./progress";
import { scoreDictation } from "./scoring/dictation";
import type { Sentence } from "./videos";

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
 * Why a day can't be opened yet, or null when it can:
 * - previous: the day before isn't done;
 * - tomorrow: the day before was done today (days open on a later calendar
 *   day, unless ignoreDates);
 * - weekClosed: the week has been settled.
 * Done days are never locked, so results and retries stay reachable.
 */
export type LockReason = "previous" | "tomorrow" | "weekClosed";

export function lockReason(
  progress: Progress | null,
  day: CycleDay,
  today: LocalDate,
  { ignoreDates = false }: StatusOptions = {},
): LockReason | null {
  if (progress?.days[day]?.done) return null;
  if (progress && progress.status !== "in-progress") return "weekClosed";
  if (day === 1) return null;

  const previous = progress?.days[(day - 1) as CycleDay];
  if (!previous?.done || !previous.date) return "previous";
  if (!ignoreDates && !isLaterDay(today, previous.date)) return "tomorrow";
  return null;
}

/**
 * Status of each day for DayTracker and page guards. A day opens ("today")
 * once the previous day is done on an earlier calendar day; Day 1 is always
 * open. Without progress, only Day 1 is open.
 */
export function dayStatuses(
  progress: Progress | null,
  today: LocalDate,
  options: StatusOptions = {},
): DayStatus[] {
  return CYCLE_DAYS.map((day) => {
    if (progress?.days[day]?.done) return "done";
    return lockReason(progress, day, today, options) ? "locked" : "today";
  });
}

/** The day to practice now, or null when today's task is done (or the week is over). */
export function currentDay(statuses: readonly DayStatus[]): CycleDay | null {
  const index = statuses.indexOf("today");
  return index === -1 ? null : ((index + 1) as CycleDay);
}

/**
 * The handout reveals the transcript, so it opens once Day 1 is done — in
 * any week, so repeating a week doesn't lock it again.
 */
export function isHandoutUnlocked(progress: Progress | null): boolean {
  return (
    Boolean(progress?.days[1]?.done) || (progress?.history.length ?? 0) > 0
  );
}

/** The latest finished day, or null before Day 1 is done. */
export function lastDoneDay(progress: Progress | null): CycleDay | null {
  const done = CYCLE_DAYS.filter((day) => progress?.days[day]?.done);
  return done.at(-1) ?? null;
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

/**
 * Whether a week that needs repeating may start again: the day after Day 7
 * was finished (days open one at a time), or right away in test mode.
 */
export function canStartNextWeek(
  progress: Progress | null,
  today: LocalDate,
  { ignoreDates = false }: StatusOptions = {},
): boolean {
  if (progress?.status !== "repeat") return false;
  const day7Date = progress.days[7]?.date;
  return ignoreDates || (day7Date !== undefined && isLaterDay(today, day7Date));
}

export type WeekComparison = {
  day1: number;
  day7: number;
  /** Per sentence, in order. */
  sentences: { day1: number; day7: number }[];
};

/** Day 1 vs Day 7 accuracy, overall and per sentence; null until both are scored. */
export function weekComparison(
  sentences: readonly Sentence[],
  progress: Progress,
): WeekComparison | null {
  const day1 = progress.days[1];
  const day7 = progress.days[7];
  if (day1?.score === undefined || day7?.score === undefined) return null;
  const accuracy = (answers: (string | null)[] | undefined, i: number) =>
    scoreDictation(sentences[i].en, answers?.[i] ?? "").accuracy;
  return {
    day1: day1.score,
    day7: day7.score,
    sentences: sentences.map((_, i) => ({
      day1: accuracy(day1.answers, i),
      day7: accuracy(day7.answers, i),
    })),
  };
}
