import { settleWeek } from "./cycle";
import type { LocalDate } from "./dates";
import { createProgress, withDay, type Progress } from "./progress";
import { scoreDictation, totalAccuracy } from "./scoring/dictation";
import type { Sentence } from "./videos";

/** Dictation happens on Day 1 and again on Day 7. */
export type DictationDay = 1 | 7;

/** One answer per sentence; null = not answered yet. */
export type Answers = readonly (string | null)[];

// --- One attempt (shared by the official run and retries) -----------------
// These work on an answers list only. Retries use them directly and never see
// a Progress, so a retry can't change the official score by construction.

export function emptyAnswers(sentenceCount: number): (string | null)[] {
  return Array.from({ length: sentenceCount }, () => null);
}

/** Index of the first sentence without an answer, or -1 when all are done. */
export function nextUnanswered(answers: Answers): number {
  return answers.findIndex((answer) => answer === null);
}

/**
 * Records the first answer for a sentence. A sentence that already has an
 * answer keeps it (the first submission counts); the same list is returned.
 */
export function recordAnswer(
  answers: Answers,
  index: number,
  answer: string,
): Answers {
  if (answers[index] !== null) return answers;
  return answers.map((a, i) => (i === index ? answer : a));
}

/** Word-weighted accuracy of a finished attempt (unanswered counts as ""). */
export function attemptScore(
  sentences: readonly Sentence[],
  answers: Answers,
): number {
  return totalAccuracy(
    sentences.map((sentence, i) =>
      scoreDictation(sentence.en, answers[i] ?? ""),
    ),
  );
}

// --- The official run (saved in Progress) ----------------------------------

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
    answers: emptyAnswers(sentenceCount),
  });
}

/**
 * Records the first submission for a sentence of the official run. When the
 * last sentence is answered, the day is marked done with its word-weighted
 * score. Finishing Day 7 also settles the week in the same update, so a
 * finished Day 7 is never left unsettled. Once done, the official record
 * never changes (retries don't use this function).
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
  if (!record || !answers || record.done) return progress;

  const next = recordAnswer(answers, index, answer);
  if (next === answers) return progress;
  if (nextUnanswered(next) !== -1) {
    return withDay(progress, day, { ...record, answers: [...next] });
  }

  const finished = withDay(progress, day, {
    done: true,
    date: today,
    score: attemptScore(sentences, next),
    answers: [...next],
  });
  return day === 7 && finished.days[1]?.score !== undefined
    ? settleWeek(finished)
    : finished;
}
