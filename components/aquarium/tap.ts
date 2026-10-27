/** A press that moves farther than this (px) is a scroll or drag, not a tap. */
export const TAP_SLOP = 10;

type Point = { x: number; y: number };

/** Whether a pointer went down and up close enough together to be a tap. */
export function isTap(down: Point, up: Point): boolean {
  return Math.hypot(up.x - down.x, up.y - down.y) < TAP_SLOP;
}

/**
 * Anything readable or interactive sits above the tank: cards (marked
 * data-solid), the header, and every control. A tap anywhere else lands on
 * the water.
 */
const SOLID =
  "a, button, input, label, select, textarea, summary, [role='button'], [data-solid], header, dialog";

export function isWaterTarget(target: EventTarget | null): boolean {
  if (typeof Element === "undefined" || !(target instanceof Element)) {
    return false;
  }
  return target.closest(SOLID) === null;
}
