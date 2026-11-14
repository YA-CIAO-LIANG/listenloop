/**
 * Practice-time levels on the practice calendar (D181): a yellow glow
 * around a day's number (D183) that steps up with the time practiced that
 * day. The thresholds are here; the color is --ll-glow in app/globals.css
 * and each level's brightness and size are in components/practice-rings.ts,
 * checked against every background theme in tests/practice-rings.test.ts.
 */
export const PRACTICE_RINGS = [
  { level: 1, minMinutes: 15 },
  { level: 2, minMinutes: 30 },
  { level: 3, minMinutes: 60 },
  { level: 4, minMinutes: 120 },
  { level: 5, minMinutes: 180 },
] as const;

export type RingLevel = 0 | (typeof PRACTICE_RINGS)[number]["level"];

/** The ring for a day's practice minutes; 0 is none. */
export function ringLevel(minutes: number): RingLevel {
  let level: RingLevel = 0;
  for (const ring of PRACTICE_RINGS) {
    if (minutes >= ring.minMinutes) level = ring.level;
  }
  return level;
}

/** Minutes as hours and minutes, for "1 hr 12 min". */
export function hoursAndMinutes(total: number): {
  hours: number;
  minutes: number;
} {
  const whole = Math.max(0, Math.round(total));
  return { hours: Math.floor(whole / 60), minutes: whole % 60 };
}
