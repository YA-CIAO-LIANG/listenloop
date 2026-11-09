import { taiwanToday } from "./admin-dashboard";

/**
 * Retention and completion for the admin dashboard (D114), from records
 * the site already keeps: sign-up dates (profiles), events (D55: sign-in,
 * starting, finishing a day, …; kept 180 days), and progress. Only totals
 * leave this module; no one is listed. Days are Taiwan calendar days.
 */
export const RETENTION_DAYS = [1, 7, 30] as const;

/** Weeks shown in the weekly-active trend. */
export const ACTIVE_WEEKS = 8;

/** The Taiwan calendar day of an ISO time, or null if it isn't one. */
export function taiwanDay(iso: unknown): string | null {
  if (typeof iso !== "string") return null;
  const time = new Date(iso);
  return Number.isNaN(time.getTime()) ? null : taiwanToday(time);
}

/** `day` plus `n` calendar days. */
export function addDay(day: string, n: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

/** Each user's active days (any event), as a set of Taiwan days. */
export function activeDays(
  events: readonly { user_id: string | null; created_at: string }[],
): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const event of events) {
    const day = taiwanDay(event.created_at);
    if (!event.user_id || !day) continue;
    const days = out.get(event.user_id) ?? new Set<string>();
    days.add(day);
    out.set(event.user_id, days);
  }
  return out;
}

export type Retention = {
  day: (typeof RETENTION_DAYS)[number];
  /** Users who signed up at least that many days ago (the base). */
  eligible: number;
  /** Of them, active on exactly that day after signing up. */
  retained: number;
  rate: number | null;
};

/**
 * Day-N retention: of the users who signed up N or more days ago (and
 * whose day N is within the events kept), the share active on day N.
 */
export function retention(
  users: readonly { user_id: string; created_at: string }[],
  active: ReadonlyMap<string, ReadonlySet<string>>,
  today: string,
  /** The first day events are kept for (older days can't be judged). */
  since: string,
): Retention[] {
  return RETENTION_DAYS.map((day) => {
    let eligible = 0;
    let retained = 0;
    for (const user of users) {
      const signedUp = taiwanDay(user.created_at);
      if (!signedUp) continue;
      const target = addDay(signedUp, day);
      if (target >= today || target < since) continue;
      eligible += 1;
      if (active.get(user.user_id)?.has(target)) retained += 1;
    }
    return {
      day,
      eligible,
      retained,
      rate: eligible ? retained / eligible : null,
    };
  });
}

/**
 * Users active in each of the last `weeks` weeks (7-day windows ending
 * today, oldest first), labeled by each window's first day.
 */
export function weeklyActive(
  active: ReadonlyMap<string, ReadonlySet<string>>,
  today: string,
  weeks = ACTIVE_WEEKS,
): { start: string; users: number }[] {
  const out: { start: string; users: number }[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const end = addDay(today, -7 * w);
    const start = addDay(end, -6);
    let users = 0;
    for (const days of active.values()) {
      if ([...days].some((day) => day >= start && day <= end)) users += 1;
    }
    out.push({ start, users });
  }
  return out;
}

/** A progress row: the material and the stored progress (lib/progress). */
export type ProgressRow = { video_id: string; data: unknown };

/** Whether this progress has finished a 7-day loop (Day 7 done once). */
export function finishedLoop(data: unknown): boolean {
  if (typeof data !== "object" || data === null) return false;
  const progress = data as {
    days?: Record<string, { done?: boolean } | undefined>;
    history?: unknown[];
    status?: string;
  };
  return (
    !!progress.days?.["7"]?.done ||
    (Array.isArray(progress.history) && progress.history.length > 0) ||
    progress.status === "passed" ||
    progress.status === "repeat"
  );
}

export type Completion = {
  started: number;
  finished: number;
  rate: number | null;
};

const completion = (started: number, finished: number): Completion => ({
  started,
  finished,
  rate: started ? finished / started : null,
});

/**
 * The share of started materials (one learner, one material) that
 * reached the end of a 7-day loop, overall and by category ("none" when
 * unknown), most started first.
 */
export function loopCompletion(
  rows: readonly ProgressRow[],
  categoryOf: (videoId: string) => string | null,
): {
  overall: Completion;
  byCategory: (Completion & { category: string })[];
} {
  let started = 0;
  let finished = 0;
  const categories = new Map<string, { started: number; finished: number }>();
  for (const row of rows) {
    const done = finishedLoop(row.data);
    started += 1;
    if (done) finished += 1;
    const category = categoryOf(row.video_id) ?? "none";
    const counts = categories.get(category) ?? { started: 0, finished: 0 };
    counts.started += 1;
    if (done) counts.finished += 1;
    categories.set(category, counts);
  }
  return {
    overall: completion(started, finished),
    byCategory: [...categories]
      .map(([category, c]) => ({
        category,
        ...completion(c.started, c.finished),
      }))
      .sort(
        (a, b) => b.started - a.started || a.category.localeCompare(b.category),
      ),
  };
}
