import type { RingLevel } from "@/lib/practice-rings";

/**
 * How each practice-time ring is drawn (D181): its color and width (full
 * class names so Tailwind finds them). Colors aren't the only signal: the
 * ring gets thicker with time, and the legend, tooltip, and screen reader
 * say the time in words.
 */
export const RING_CLASS: Record<Exclude<RingLevel, 0>, string> = {
  1: "border-[1px] border-practice-1",
  2: "border-[1.5px] border-practice-2",
  3: "border-2 border-practice-3",
  4: "border-3 border-practice-4",
  5: "border-4 border-practice-5",
};
