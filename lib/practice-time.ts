import type { Activity, DayActivity } from "./activity";
import type { LocalDate } from "./dates";

/**
 * Time spent practicing (D74), kept in the activity log (ll-activity:v1)
 * per day as `time`: seconds per device, per material. Only time on a
 * practice page counts, with the page in front, the window focused, and
 * the learner active (typing, clicking, or audio playing) within the last
 * IDLE_LIMIT_MS. Each device only adds to its own count, so merging two
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

/** A day's practice time in seconds, every device and material added. */
export function daySeconds(day: DayActivity | undefined): number {
  let total = 0;
  for (const device of Object.values(day?.time ?? {})) {
    for (const seconds of Object.values(device)) total += seconds;
  }
  return total;
}

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
 * Whether the learner counts as practicing at `now`: page in front,
 * window focused, and active within IDLE_LIMIT_MS, or audio playing.
 */
export function isPracticing({
  visible,
  focused,
  playing,
  lastActive,
  now,
}: {
  visible: boolean;
  focused: boolean;
  playing: boolean;
  lastActive: number;
  now: number;
}): boolean {
  if (!visible) return false;
  if (playing) return true;
  return focused && now - lastActive < IDLE_LIMIT_MS;
}
