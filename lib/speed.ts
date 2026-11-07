import type { DictationResult } from "./scoring/dictation";

/**
 * Playback speed and the accuracy it earns (D73), in one place. Audio
 * practices play at 0.75×, 1×, or 1.25× without changing pitch; YouTube
 * videos stay at 1× (CLAUDE.md: no speed switch for videos). Dictation
 * answers count by the speed they were heard at: slower is easier, so it
 * counts for less, faster for a little more, and a day never passes 100%.
 */
export const SPEEDS = [0.75, 1, 1.25] as const;
export type Speed = (typeof SPEEDS)[number];

export const DEFAULT_SPEED: Speed = 1;

/** How much an answer heard at each speed counts. */
export const SPEED_WEIGHTS: Readonly<Record<`${Speed}`, number>> = {
  "0.75": 0.9,
  "1": 1,
  "1.25": 1.05,
};

/** Weighted accuracy never goes above this. */
export const WEIGHTED_CAP = 1;

export const isSpeed = (value: unknown): value is Speed =>
  (SPEEDS as readonly unknown[]).includes(value);

/** An answer's weight; unknown speeds (older records) count as 1×. */
export function speedWeight(speed: number | null | undefined): number {
  return isSpeed(speed) ? SPEED_WEIGHTS[`${speed}`] : 1;
}

/**
 * A day's weighted accuracy: each sentence's correct words times its
 * speed's weight, over the same denominators as the raw accuracy
 * (totalAccuracy), at most WEIGHTED_CAP.
 */
export function weightedAccuracy(
  results: readonly Pick<DictationResult, "correct" | "total">[],
  speeds: readonly (number | null | undefined)[],
): number {
  const total = results.reduce((sum, r) => sum + r.total, 0);
  if (total === 0) return WEIGHTED_CAP;
  const earned = results.reduce(
    (sum, r, i) => sum + r.correct * speedWeight(speeds[i]),
    0,
  );
  return Math.min(WEIGHTED_CAP, earned / total);
}

export type Pace = "slow" | "fast";

/**
 * How the day was heard, for the "慢速完成" / "快速完成" label: the
 * average speed of the answered sentences, weighted by their words.
 * Null at 1× (or with nothing answered).
 */
export function pace(
  results: readonly Pick<DictationResult, "total">[],
  speeds: readonly (number | null | undefined)[],
): Pace | null {
  let words = 0;
  let sum = 0;
  results.forEach((r, i) => {
    const heard = speeds[i];
    const speed = isSpeed(heard) ? heard : DEFAULT_SPEED;
    words += r.total;
    sum += r.total * speed;
  });
  if (words === 0) return null;
  const average = sum / words;
  return average < 1 - 1e-9 ? "slow" : average > 1 + 1e-9 ? "fast" : null;
}
