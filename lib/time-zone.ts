import { isTimeZone } from "./reminders";

/**
 * Whose clock dates follow (D139): the learner's device. "Today", the
 * day's tasks, the 7-day unlocks, review dates, and streaks are worked out
 * in the browser in its own time zone; dates the server writes into a
 * page use the same zone, which the browser keeps in a cookie (and, signed
 * in, in the profile, so reminders follow it too). Usage limits still
 * reset at midnight Taiwan time (lib/usage.ts), as before.
 */
export const TIME_ZONE_COOKIE = "ll-tz";

/** Before the browser has said: most learners are in Taiwan. */
export const DEFAULT_TIME_ZONE = "Asia/Taipei";

export function timeZoneOr(value: unknown): string {
  return isTimeZone(value) ? value : DEFAULT_TIME_ZONE;
}

export { isTimeZone };
