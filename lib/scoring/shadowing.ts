import { alignWords, countMatches, type AlignOp } from "./align";
import { normalizeWords } from "./normalize";

/** A sentence counts as read aloud when at least this share of words is heard. */
export const COVERAGE_THRESHOLD = 0.7;

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
    complete: coverage >= COVERAGE_THRESHOLD,
    missedIndexes,
  };
}
