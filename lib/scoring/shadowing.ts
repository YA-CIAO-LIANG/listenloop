import { alignWords, countMatches, type AlignOp } from "./align";
import { normalizeWords } from "./normalize";

import { DEFAULT_PASS_RULES } from "../pass-rules";

/**
 * By default a sentence counts as read aloud when at least this share of
 * words is heard; each practice can set its own (D92).
 */
export const COVERAGE_THRESHOLD = DEFAULT_PASS_RULES.shadowingMin;

export type ShadowingResult = {
  ops: AlignOp[];
  /** Matched reference words / reference words, between 0 and 1. */
  coverage: number;
  complete: boolean;
  /** Positions (in normalized reference words) that weren't heard. */
  missedIndexes: number[];
};

/** Scores a speech-recognition transcript against the reference sentence. */
export function scoreShadowing(
  reference: string,
  transcript: string,
  /** The practice's threshold (D92). */
  threshold: number = COVERAGE_THRESHOLD,
): ShadowingResult {
  const ops = alignWords(normalizeWords(reference), normalizeWords(transcript));
  const refOps = ops.filter((op) => op.type !== "insert");
  const coverage = refOps.length === 0 ? 1 : countMatches(ops) / refOps.length;

  const missedIndexes = refOps.flatMap((op, index) =>
    op.type === "match" ? [] : [index],
  );

  return {
    ops,
    coverage,
    // Scores are sums of fractions; 0.6 can arrive as 0.5999999999999999.
    complete: coverage + 1e-9 >= threshold,
    missedIndexes,
  };
}
