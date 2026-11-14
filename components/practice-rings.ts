import type { CSSProperties } from "react";
import type { RingLevel } from "@/lib/practice-rings";

/**
 * How each practice-time level is drawn (D181; a glow since D183): a
 * yellow glow around the day's dot (--ll-glow), brighter and wider the
 * longer the day's practice. `strength` is the glow color's opacity (%),
 * `blur` and `spread` its box-shadow (px). The glow isn't the only
 * signal: the legend, tooltip, the selected day's line, and the screen
 * reader say the time in words.
 */
export const GLOW: Record<
  Exclude<RingLevel, 0>,
  { strength: number; blur: number; spread: number }
> = {
  1: { strength: 35, blur: 4, spread: 1 },
  2: { strength: 50, blur: 6, spread: 1.5 },
  3: { strength: 65, blur: 8, spread: 2 },
  4: { strength: 82, blur: 10, spread: 3 },
  5: { strength: 100, blur: 12, spread: 4 },
};

/** The box-shadow for a level; `scale` shrinks it for the legend. */
export function glowStyle(
  level: Exclude<RingLevel, 0>,
  scale = 1,
): CSSProperties {
  const { strength, blur, spread } = GLOW[level];
  const color = `color-mix(in srgb, var(--ll-glow) ${strength}%, transparent)`;
  return {
    boxShadow: `0 0 ${blur * scale}px ${spread * scale}px ${color}`,
  };
}
