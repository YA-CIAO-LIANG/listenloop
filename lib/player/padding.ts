import type { Sentence } from "../videos";

/** Seconds to start before a sentence, so the first sound isn't clipped. */
export const PAD_BEFORE = 0.15;

/** Seconds to keep playing after a sentence, so the last word can trail off. */
export const PAD_AFTER = 0.25;

export type Padding = { before: number; after: number };

export const DEFAULT_PADDING: Padding = {
  before: PAD_BEFORE,
  after: PAD_AFTER,
};

// Millisecond precision avoids float noise like 107.10000000000001.
const round = (seconds: number) => Math.round(seconds * 1000) / 1000;

/**
 * The time range to actually play for `sentences[index]`: the sentence plus
 * padding, but never into a neighbor. It won't start before the previous
 * sentence ends (or before 0), or end after the next sentence starts.
 */
export function paddedSegment(
  sentences: readonly Pick<Sentence, "start" | "end">[],
  index: number,
  { before, after }: Padding = DEFAULT_PADDING,
): { start: number; end: number } {
  const sentence = sentences[index];
  const previous = sentences[index - 1];
  const next = sentences[index + 1];

  const earliest = previous ? previous.end : 0;
  const latest = next ? next.start : Infinity;

  return {
    start: round(Math.max(sentence.start - before, earliest, 0)),
    end: round(Math.min(sentence.end + after, latest)),
  };
}
