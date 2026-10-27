import type { LocalDate } from "./dates";
import {
  createProgress,
  withDay,
  type Progress,
  type ShadowingSentenceRecord,
} from "./progress";
import { COVERAGE_THRESHOLD } from "./scoring/shadowing";

/** Shadowing happens on Days 2–6. */
export type ShadowingDay = 2 | 3 | 4 | 5 | 6;

export const SHADOWING_DAYS: readonly ShadowingDay[] = [2, 3, 4, 5, 6];

export function isShadowingDay(day: number): day is ShadowingDay {
  return SHADOWING_DAYS.includes(day as ShadowingDay);
}

/** One attempt at a sentence: a recognized coverage, or "I said it" by hand. */
export type ShadowingAttempt = { coverage: number } | { manual: true };

export type SentenceRecords = readonly ShadowingSentenceRecord[];

// --- One run (shared by the official run and retries) ---------------------

export function emptySentenceRecords(count: number): ShadowingSentenceRecord[] {
  return Array.from({ length: count }, () => ({ done: false, coverage: null }));
}

/** Index of the first sentence not yet done, or -1 when all are done. */
export function nextUnfinished(records: SentenceRecords): number {
  return records.findIndex((record) => !record.done);
}

/**
 * Records an attempt. A sentence is done once any attempt reaches
 * COVERAGE_THRESHOLD (70%) or the learner marks it done by hand (when speech
 * recognition isn't available). The best coverage is kept; a done sentence
 * never becomes undone.
 */
export function recordAttempt(
  records: SentenceRecords,
  index: number,
  attempt: ShadowingAttempt,
): SentenceRecords {
  const previous = records[index];
  if (!previous) return records;

  if ("manual" in attempt) {
    if (previous.done) return records;
    return records.map((r, i) => (i === index ? { ...r, done: true } : r));
  }

  const coverage = Math.max(previous.coverage ?? 0, attempt.coverage);
  const done = previous.done || attempt.coverage >= COVERAGE_THRESHOLD;
  if (done === previous.done && coverage === previous.coverage) return records;
  return records.map((r, i) => (i === index ? { done, coverage } : r));
}

/** Average of recognized coverage (manual-only sentences are left out). */
export function averageCoverage(records: SentenceRecords): number | null {
  const measured = records
    .map((r) => r.coverage)
    .filter((c): c is number => c !== null);
  if (measured.length === 0) return null;
  return measured.reduce((sum, c) => sum + c, 0) / measured.length;
}

// --- The official run (saved in Progress) ----------------------------------

/** Progress ready for shadowing on `day`, created or resumed. */
export function startShadowing(
  progress: Progress | null,
  videoId: string,
  day: ShadowingDay,
  sentenceCount: number,
  today: LocalDate,
): Progress {
  const base = progress ?? createProgress(videoId, today);
  const record = base.days[day];
  if (record?.sentences?.length === sentenceCount) return base;
  return withDay(base, day, {
    done: false,
    sentences: emptySentenceRecords(sentenceCount),
  });
}

/**
 * Records an attempt in the official run. When every sentence is done, the
 * day is marked done with today's date. A finished day never changes again
 * (retries don't use this function).
 */
export function submitShadowing(
  progress: Progress,
  day: ShadowingDay,
  index: number,
  attempt: ShadowingAttempt,
  today: LocalDate,
): Progress {
  const record = progress.days[day];
  const sentences = record?.sentences;
  if (!record || !sentences || record.done) return progress;

  const next = recordAttempt(sentences, index, attempt);
  if (next === sentences) return progress;
  const done = nextUnfinished(next) === -1;
  return withDay(progress, day, {
    done,
    ...(done ? { date: today } : {}),
    sentences: [...next],
  });
}
