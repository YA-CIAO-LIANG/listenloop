import type { LocalDate } from "./dates";
import { createProgress, withDay, type Progress } from "./progress";
import { scoreDictation, totalAccuracy } from "./scoring/dictation";
import type { Sentence } from "./videos";

/** Dictation happens on Day 1 and again on Day 7. */
export type DictationDay = 1 | 7;

/**
 * Progress ready for dictation: creates it if missing and gives the day an
 * answers list (one null per sentence) if it doesn't have one yet.
 */
export function startDictation(
  progress: Progress | null,
  videoId: string,
  day: DictationDay,
  sentenceCount: number,
  today: LocalDate,
): Progress {
  const base = progress ?? createProgress(videoId, today);
  const record = base.days[day];
  if (record?.answers?.length === sentenceCount) return base;
  return withDay(base, day, {
    done: false,
    answers: Array.from({ length: sentenceCount }, () => null),
  });
}

/** Index of the first sentence without an answer, or -1 when all are done. */
export function nextUnanswered(answers: readonly (string | null)[]): number {
  return answers.findIndex((answer) => answer === null);
}

/**
 * Records the first submission for a sentence. Later submissions for the
 * same sentence are ignored (the first answer counts). When the last
 * sentence is answered, the day is marked done with its word-weighted score.
 */
export function submitAnswer(
  progress: Progress,
  day: DictationDay,
  index: number,
  answer: string,
  sentences: readonly Sentence[],
  today: LocalDate,
): Progress {
  const record = progress.days[day];
  const answers = record?.answers;
  if (!record || !answers || record.done || answers[index] !== null) {
    return progress;
  }

  const next = answers.map((a, i) => (i === index ? answer : a));
  if (nextUnanswered(next) !== -1) {
    return withDay(progress, day, { ...record, answers: next });
  }

  const score = totalAccuracy(
    sentences.map((sentence, i) => scoreDictation(sentence.en, next[i] ?? "")),
  );
  return withDay(progress, day, {
    done: true,
    date: today,
    score,
    answers: next,
  });
}
