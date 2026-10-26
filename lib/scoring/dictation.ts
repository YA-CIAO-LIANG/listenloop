import { alignWords, countMatches, type AlignOp } from "./align";
import { normalizeWords } from "./normalize";

export type DictationResult = {
  ops: AlignOp[];
  /** Reference words the user typed correctly. */
  correct: number;
  /** Words in the reference sentence. */
  referenceWords: number;
  /** Words the user typed. */
  answerWords: number;
  /** Denominator: max(referenceWords, answerWords). */
  total: number;
  /** correct / total, between 0 and 1. */
  accuracy: number;
};

/**
 * Scores one typed answer against the reference sentence:
 * correct / max(reference words, answer words). Dividing by the longer of
 * the two means padding an answer with extra words lowers the score, so
 * typing a long list of common words can't game the 80% pass mark.
 */
export function scoreDictation(
  reference: string,
  answer: string,
): DictationResult {
  const ref = normalizeWords(reference);
  const hyp = normalizeWords(answer);
  const ops = alignWords(ref, hyp);
  const correct = countMatches(ops);
  const total = Math.max(ref.length, hyp.length);
  return {
    ops,
    correct,
    referenceWords: ref.length,
    answerWords: hyp.length,
    total,
    accuracy: total === 0 ? 1 : correct / total,
  };
}

/**
 * A day's accuracy across sentences, weighted by word count:
 * all correct words / sum of each sentence's denominator. A 3-word sentence
 * counts less than a 15-word one, so one typo costs the same everywhere, and
 * extra words still count against the day.
 */
export function totalAccuracy(
  results: readonly Pick<DictationResult, "correct" | "total">[],
): number {
  const total = results.reduce((sum, r) => sum + r.total, 0);
  const correct = results.reduce((sum, r) => sum + r.correct, 0);
  return total === 0 ? 1 : correct / total;
}
