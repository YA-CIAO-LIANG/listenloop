import type { Sentence } from "../videos";

/** Each sentence ends this long before the next one starts (seconds). */
export const TAP_GAP = 0.1;

/** Last sentence's length when no end was tapped (seconds). */
const LAST_FALLBACK = 3;

const round = (seconds: number) => Math.round(seconds * 100) / 100;

/**
 * Sentence times from tap mode: `taps[n]` is when sentence n started (a
 * Space press while the video played); each ends TAP_GAP before the next
 * starts, and the last at `finalEnd` (Enter) if given. Sentences not tapped
 * yet keep their times.
 */
export function applyTaps(
  sentences: readonly Sentence[],
  taps: readonly number[],
  finalEnd: number | null = null,
): Sentence[] {
  return sentences.map((sentence, i) => {
    if (i >= taps.length) return sentence;
    const start = round(taps[i]);
    const next = taps[i + 1];
    let end: number;
    if (next !== undefined) end = next - TAP_GAP;
    else if (finalEnd !== null) end = finalEnd;
    else end = taps[i] + LAST_FALLBACK;
    return { ...sentence, start, end: round(Math.max(end, start + 0.2)) };
  });
}
