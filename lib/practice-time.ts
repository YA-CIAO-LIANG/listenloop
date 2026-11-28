import type { Activity, DayActivity } from "./activity";
import type { LocalDate } from "./dates";

/**
 * Time spent practicing (D74, D181), kept in the activity log
 * (ll-activity:v1) per day as `time`: seconds per device, per material.
 * Only time actually practicing counts: dictation, shadowing, listening
 * mode, the vocabulary quiz, and the misheard-words review, with the page
 * in front, the window focused, and the learner active (typing, clicking,
 * or audio playing) within the last IDLE_LIMIT_MS. A page in the
 * background or another tab pauses it (D181), except listening mode while
 * its audio plays: just listening counts, on the lock screen too (D183).
 * Each second goes to the learner's local date when it was counted. Each
 * device only adds to its own count, so merging two
 * devices takes the larger count for each device and material and adds
 * the devices up: practicing on a phone and a laptop on the same day is
 * never counted once, nor twice.
 */

/** No input or playback for this long and the clock stops. */
export const IDLE_LIMIT_MS = 2 * 60 * 1000;

/** How often counted time is saved while practicing. */
export const SAVE_EVERY_MS = 30 * 1000;

/** Seconds per material on one device. */
export type DeviceTime = Record<string, number>;

/** One day's time: per device id, per material id. */
export type DayTime = Record<string, DeviceTime>;

const dayOf = (activity: Activity, date: LocalDate): DayActivity =>
  activity.days[date] ?? { official: false, retries: [] };

/** Adds `seconds` of practice on `videoId` to this device's count. */
export function addPracticeTime(
  activity: Activity,
  date: LocalDate,
  device: string,
  videoId: string,
  seconds: number,
): Activity {
  if (!(seconds > 0)) return activity;
  const day = dayOf(activity, date);
  const time = day.time ?? {};
  const mine = time[device] ?? {};
  return {
    ...activity,
    days: {
      ...activity.days,
      [date]: {
        ...day,
        time: {
          ...time,
          [device]: {
            ...mine,
            [videoId]: Math.round((mine[videoId] ?? 0) + seconds),
          },
        },
      },
    },
  };
}

/** Two copies of a day's time: the larger count per device and material. */
export function mergeDayTime(a: DayTime, b: DayTime): DayTime {
  const merged: DayTime = {};
  for (const device of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[device] ?? {};
    const y = b[device] ?? {};
    merged[device] = {};
    for (const video of new Set([...Object.keys(x), ...Object.keys(y)])) {
      merged[device][video] = Math.max(x[video] ?? 0, y[video] ?? 0);
    }
  }
  return merged;
}

/**
 * The key the misheard-words review (D108) counts its time under: it
 * spans materials, so it isn't one.
 */
export const REVIEW_TIME_KEY = "review";

/** The practice-time ids of writing (D187): "w-<promptId>", "w-chat". */
export const isWritingTimeId = (id: string) => id.startsWith("w-");

/**
 * Listening's practice time (D214): every material that isn't writing's,
 * the misheard-words review included. Listening and writing never add
 * their time together: each has its own calendar, streak, and stats.
 */
export const isListeningTimeId = (id: string) => !isWritingTimeId(id);

/**
 * A day's practice time in seconds, every device and material added; or
 * only the materials `which` keeps (listening or writing, D201).
 */
export function daySeconds(
  day: DayActivity | undefined,
  which: (material: string) => boolean = () => true,
): number {
  let total = 0;
  for (const device of Object.values(day?.time ?? {})) {
    for (const [material, seconds] of Object.entries(device)) {
      if (which(material)) total += seconds;
    }
  }
  return total;
}

/**
 * A day's practice time in whole minutes (rounded): what the calendar's
 * rings and the stats page both show, so their numbers agree (D181).
 */
export const practiceMinutes = (
  day: DayActivity | undefined,
  which?: (material: string) => boolean,
): number => Math.round(daySeconds(day, which) / 60);

/** Seconds per material on a day, devices added up. */
export function secondsByMaterial(
  day: DayActivity | undefined,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const device of Object.values(day?.time ?? {})) {
    for (const [video, seconds] of Object.entries(device)) {
      out[video] = (out[video] ?? 0) + seconds;
    }
  }
  return out;
}

/** Whether stored data is a day's time (validation for parseActivity). */
export function isDayTime(value: unknown): value is DayTime {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every(
    (device) =>
      typeof device === "object" &&
      device !== null &&
      !Array.isArray(device) &&
      Object.values(device).every(
        (s) => typeof s === "number" && Number.isFinite(s) && s >= 0,
      ),
  );
}

/**
 * Whether the learner counts as practicing at `now`: page in front and
 * active within IDLE_LIMIT_MS (with the window focused), or audio playing
 * on the page in front. Hidden (another tab, the screen locked, the app
 * in the background) doesn't count (D181), except listening mode's audio
 * still playing (`background`): just listening is practice too (D183).
 */
export function isPracticing({
  visible,
  focused,
  playing,
  lastActive,
  now,
  background = false,
}: {
  visible: boolean;
  focused: boolean;
  playing: boolean;
  lastActive: number;
  now: number;
  /** Audio playing in the background counts (listening mode, D183). */
  background?: boolean;
}): boolean {
  if (playing && background) return true;
  if (!visible) return false;
  if (playing) return true;
  return focused && now - lastActive < IDLE_LIMIT_MS;
}

/** Counted seconds not saved yet, and the local date they belong to. */
export type TimerState = {
  date: LocalDate | null;
  pending: number;
  sinceSave: number;
};

export const TIMER_START: TimerState = { date: null, pending: 0, sinceSave: 0 };

/** Seconds to add to a date's count. */
export type TimerFlush = { date: LocalDate; seconds: number };

/**
 * Longest gap between two ticks that still counts in full: a page in the
 * background gets its timers slowed to about one a minute (D183); a
 * longer gap (the browser froze the page) counts this much.
 */
export const MAX_TICK_SECONDS = 60;

/**
 * One tick of the practice timer: `seconds` since the last one (1 in
 * front; up to MAX_TICK_SECONDS in the background). Counted seconds
 * belong to `date` (the learner's local date now): when the date changes
 * (midnight), what was pending is saved to the day before first. Saves
 * every SAVE_EVERY_MS.
 */
export function timerTick(
  state: TimerState,
  {
    counting,
    date,
    seconds = 1,
  }: { counting: boolean; date: LocalDate; seconds?: number },
): { state: TimerState; flush: TimerFlush | null } {
  if (!counting) return { state, flush: null };
  const add = Math.min(Math.max(Math.round(seconds), 1), MAX_TICK_SECONDS);
  if (state.date && state.date !== date && state.pending > 0) {
    return {
      state: { date, pending: add, sinceSave: add * 1000 },
      flush: { date: state.date, seconds: state.pending },
    };
  }
  const next = {
    date,
    pending: state.pending + add,
    sinceSave: state.sinceSave + add * 1000,
  };
  if (next.sinceSave >= SAVE_EVERY_MS) {
    return {
      state: { date, pending: 0, sinceSave: 0 },
      flush: { date, seconds: next.pending },
    };
  }
  return { state: next, flush: null };
}

/** What to save now (the page is hidden or left), and the state after. */
export function timerFlush(state: TimerState): {
  state: TimerState;
  flush: TimerFlush | null;
} {
  if (!state.date || state.pending <= 0) return { state, flush: null };
  return {
    state: { ...state, pending: 0, sinceSave: 0 },
    flush: { date: state.date, seconds: state.pending },
  };
}
