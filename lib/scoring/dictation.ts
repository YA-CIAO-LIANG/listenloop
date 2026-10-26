import { alignWords, countMatches, type AlignOp } from "./align";
import { normalizeWords } from "./normalize";

export type DictationResult = {
  ops: AlignOp[];
  /** Reference words the user typed correctly. */
  correct: number;
  /** Words in the reference sentence. */
  total: number;
  /** correct / total, between 0 and 1. */
  accuracy: number;
};

/** Scores one typed answer against the reference sentence. */
export function scoreDictation(
  reference: string,
  answer: string,
): DictationResult {
  const ops = alignWords(normalizeWords(reference), normalizeWords(answer));
  const total = ops.filter((op) => op.type !== "insert").length;
  const correct = countMatches(ops);
  return { ops, correct, total, accuracy: total === 0 ? 1 : correct / total };
}

/**
 * A day's accuracy across sentences, weighted by word count: all correct
 * words / all reference words. A 3-word sentence counts less than a 15-word
 * one, so one typo costs the same everywhere.
 */
export function totalAccuracy(
  results: readonly Pick<DictationResult, "correct" | "total">[],
): number {
  const total = results.reduce((sum, r) => sum + r.total, 0);
  const correct = results.reduce((sum, r) => sum + r.correct, 0);
  return total === 0 ? 1 : correct / total;
}
