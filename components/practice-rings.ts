import type { RingLevel } from "@/lib/practice-rings";

/**
 * How each practice-time ring is drawn (D181, redrawn D182): an outline
 * around the day's dot, 2 px out, so the card shows between the dot and
 * the ring (no halo of another color). Its color and width (full class
 * names so Tailwind finds them). Colors aren't the only signal: the ring
 * gets thicker with time, and the legend, tooltip, and screen reader say
 * the time in words.
 */
export const RING_CLASS: Record<Exclude<RingLevel, 0>, string> = {
  1: "outline-1 outline-offset-2 outline-practice-1",
  2: "outline-[1.5px] outline-offset-2 outline-practice-2",
  3: "outline-2 outline-offset-2 outline-practice-3",
  4: "outline-3 outline-offset-2 outline-practice-4",
  5: "outline-4 outline-offset-2 outline-practice-5",
};

/** The legend's smaller samples: the same colors and widths, 1.5 px out. */
export const RING_SAMPLE_CLASS: Record<Exclude<RingLevel, 0>, string> = {
  1: "outline-1 outline-offset-[1.5px] outline-practice-1",
  2: "outline-[1.5px] outline-offset-[1.5px] outline-practice-2",
  3: "outline-2 outline-offset-[1.5px] outline-practice-3",
  4: "outline-3 outline-offset-[1.5px] outline-practice-4",
  5: "outline-4 outline-offset-[1.5px] outline-practice-5",
};
