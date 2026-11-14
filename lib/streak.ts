import type { Activity } from "./activity";
import { addDays, type LocalDate } from "./dates";
import { tasksByDate } from "./practice-calendar";
import { daySeconds } from "./practice-time";
import type { Progress } from "./progress";

/**
 * Practice streaks with a weekly streak freeze (D176). Every rule lives
 * here, so changing how forgiving the streak is never touches the pages.
 *
 * A freeze isn't stored anywhere: it's worked out from the practice dates
 * alone, oldest first, so every device (and the account) gets the same
 * answer without new data to sync.
 *
 * - One freeze per week; weeks start on Monday (the learner's local date).
 * - A freeze covers one missed day between two practice days (or between
 *   the last practice day and today). Two missed days in a row break the
 *   streak: no freeze bridges them.
 * - The freeze belongs to the week of the day it covers, and is used
 *   automatically, the first time a gap in that week needs it.
 * - A covered day keeps the streak alive but isn't counted in it.
 * - Missed days before `since` (when the feature shipped) are never
 *   covered, so older streaks stay what they were.
 */
export const STREAK_FREEZE = {
  /** Freezes a week. */
  perWeek: 1,
  /** The longest run of missed days one freeze covers. */
  maxMissedDays: 1,
  /** The first missed day a freeze can cover (the feature's first Monday). */
  since: "2026-11-09",
  /** Say "a freeze saved your streak" while the covered day is this recent. */
  savedNoticeDays: 7,
} as const;

export type StreakStatus = {
  /** Practice days in the run ending today (or kept alive to today). */
  current: number;
  longest: number;
  /** Freezes left in this week (today's week). */
  freezesLeft: number;
  /** Days covered by a freeze in the current run, oldest first. */
  frozen: LocalDate[];
};

/** Days apart between two local dates (b after a). */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  const [ya, ma, da] = a.split("-").map(Number);
  const [yb, mb, db] = b.split("-").map(Number);
  return Math.round(
    (Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86_400_000,
  );
}

/** The Monday that starts `date`'s week. */
export function weekStart(date: LocalDate): LocalDate {
  const [y, m, d] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return addDays(date, -((weekday + 6) % 7));
}

/**
 * Days with practice: an official task finished (the activity log or the
 * dates in progress) or practice time counted (D74).
 */
export function practiceDays(
  activity: Activity,
  progresses: readonly Progress[],
): Set<LocalDate> {
  const days = new Set<LocalDate>(tasksByDate(activity, progresses).keys());
  for (const [date, day] of Object.entries(activity.days)) {
    if (day?.official || daySeconds(day) > 0) days.add(date);
  }
  return days;
}

/**
 * The current and longest streak, with freezes applied (rules above).
 * Practice after `today` (another device's clock) is ignored.
 */
export function streakStatus(
  days: Iterable<LocalDate>,
  today: LocalDate,
): StreakStatus {
  const sorted = [...new Set(days)].filter((d) => d <= today).sort();
  const used = new Map<LocalDate, number>();
  // Uses a freeze for the missed days after `last` (before `next`), if allowed.
  const freeze = (last: LocalDate, missed: number): LocalDate[] | null => {
    if (missed < 1 || missed > STREAK_FREEZE.maxMissedDays) return null;
    const covered = Array.from({ length: missed }, (_, i) =>
      addDays(last, i + 1),
    );
    if (covered[0] < STREAK_FREEZE.since) return null;
    const week = weekStart(covered[0]);
    if (covered.some((d) => weekStart(d) !== week)) return null;
    const count = used.get(week) ?? 0;
    if (count >= STREAK_FREEZE.perWeek) return null;
    used.set(week, count + 1);
    return covered;
  };

  let run = 0;
  let longest = 0;
  let frozen: LocalDate[] = [];
  sorted.forEach((date, i) => {
    const missed = i === 0 ? -1 : daysBetween(sorted[i - 1], date) - 1;
    const covered = missed > 0 ? freeze(sorted[i - 1], missed) : null;
    if (missed === 0 || covered) {
      run += 1;
      if (covered) frozen = [...frozen, ...covered];
    } else {
      run = 1;
      frozen = [];
    }
    longest = Math.max(longest, run);
  });

  let current = 0;
  const last = sorted.at(-1);
  if (last) {
    // Today isn't over, so it never counts as missed.
    const missed = daysBetween(last, today) - 1;
    if (missed <= 0) current = run;
    else {
      const covered = freeze(last, missed);
      if (covered) {
        current = run;
        frozen = [...frozen, ...covered];
      }
    }
  }

  return {
    current,
    longest,
    freezesLeft: Math.max(
      0,
      STREAK_FREEZE.perWeek - (used.get(weekStart(today)) ?? 0),
    ),
    frozen: current > 0 ? frozen : [],
  };
}

/**
 * The latest day a freeze covered in the current run, while recent enough
 * to tell the learner (STREAK_FREEZE.savedNoticeDays); otherwise null.
 */
export function recentFreeze(
  status: StreakStatus,
  today: LocalDate,
): LocalDate | null {
  const latest = status.frozen.at(-1);
  if (!latest) return null;
  return daysBetween(latest, today) <= STREAK_FREEZE.savedNoticeDays
    ? latest
    : null;
}
