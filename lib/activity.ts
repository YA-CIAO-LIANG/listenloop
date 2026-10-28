import { isLocalDate, type LocalDate } from "./dates";
import type { Progress } from "./progress";

/** One finished official task: which video, which week, which day. */
export type PracticeTask = { videoId: string; week: number; day: number };

/**
 * What happened on one calendar day. Retries aren't saved in progress (they
 * never change official results), so they are logged here for rewards.
 * `tasks` keeps each finished official task for the practice calendar, so
 * repeating a week (which clears its days) doesn't erase the history. It's
 * practice data, kept whether or not the reward features are on.
 */
export type DayActivity = {
  /** An official task was finished that day. */
  official: boolean;
  /** Videos with a finished retry that day, each listed once. */
  retries: string[];
  /** Official tasks finished that day (added later; older logs lack it). */
  tasks?: PracticeTask[];
};

/** Saved as ll-activity:v1 (see CLAUDE.md 資料格式). */
export type Activity = { days: Partial<Record<LocalDate, DayActivity>> };

export function emptyActivity(): Activity {
  return { days: {} };
}

const dayOf = (activity: Activity, date: LocalDate): DayActivity =>
  activity.days[date] ?? { official: false, retries: [] };

const withDayActivity = (
  activity: Activity,
  date: LocalDate,
  day: DayActivity,
): Activity => ({ days: { ...activity.days, [date]: day } });

/** Notes an official task finished on `date` (same object if already noted). */
export function recordOfficial(activity: Activity, date: LocalDate): Activity {
  const day = dayOf(activity, date);
  if (day.official) return activity;
  return withDayActivity(activity, date, { ...day, official: true });
}

/** Notes a finished official task on `date` (same object if already noted). */
export function recordTask(
  activity: Activity,
  date: LocalDate,
  task: PracticeTask,
): Activity {
  const day = dayOf(activity, date);
  const tasks = day.tasks ?? [];
  const known = tasks.some(
    (t) =>
      t.videoId === task.videoId && t.week === task.week && t.day === task.day,
  );
  if (known && day.official) return activity;
  return withDayActivity(activity, date, {
    ...day,
    official: true,
    tasks: known ? tasks : [...tasks, task],
  });
}

/** Notes a finished retry of a video on `date` (same object if already noted). */
export function recordRetry(
  activity: Activity,
  date: LocalDate,
  videoId: string,
): Activity {
  const day = dayOf(activity, date);
  if (day.retries.includes(videoId)) return activity;
  return withDayActivity(activity, date, {
    ...day,
    retries: [...day.retries, videoId],
  });
}

/**
 * Days with an official task, oldest first: logged days plus the completion
 * dates kept in progress (so practice from before the log still counts).
 */
export function officialDates(
  activity: Activity,
  progresses: readonly Progress[],
): LocalDate[] {
  const dates = new Set<LocalDate>();
  for (const [date, day] of Object.entries(activity.days)) {
    if (day?.official) dates.add(date);
  }
  for (const progress of progresses) {
    for (const record of Object.values(progress.days)) {
      if (record?.done && record.date) dates.add(record.date);
    }
  }
  return [...dates].sort();
}

function isTask(value: unknown): value is PracticeTask {
  if (typeof value !== "object" || value === null) return false;
  const { videoId, week, day } = value as Record<string, unknown>;
  return (
    typeof videoId === "string" &&
    Number.isInteger(week) &&
    (week as number) >= 1 &&
    Number.isInteger(day) &&
    (day as number) >= 1 &&
    (day as number) <= 7
  );
}

/** Validates stored data; anything malformed returns null (treated as empty). */
export function parseActivity(data: unknown): Activity | null {
  if (typeof data !== "object" || data === null) return null;
  const days = (data as { days?: unknown }).days;
  if (typeof days !== "object" || days === null || Array.isArray(days)) {
    return null;
  }
  for (const [date, day] of Object.entries(days)) {
    if (!isLocalDate(date) || typeof day !== "object" || day === null) {
      return null;
    }
    const { official, retries, tasks } = day as Record<string, unknown>;
    if (
      typeof official !== "boolean" ||
      !Array.isArray(retries) ||
      !retries.every((id) => typeof id === "string")
    ) {
      return null;
    }
    if (tasks !== undefined && !(Array.isArray(tasks) && tasks.every(isTask))) {
      return null;
    }
  }
  return data as Activity;
}
