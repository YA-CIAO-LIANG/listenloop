import { settleWeek } from "./cycle";
import type { LocalDate } from "./dates";
import { createProgress, pinVersion, withDay, type Progress } from "./progress";
import { scoreDictation, totalAccuracy } from "./scoring/dictation";
import { DEFAULT_SPEED, weightedAccuracy } from "./speed";
import type { Sentence } from "./videos";

/** Dictation happens on Day 1 and again on Day 7. */
export type DictationDay = 1 | 7;

/** One answer per sentence; null = not answered yet. */
export type Answers = readonly (string | null)[];

/** The speed each answer was heard at (D73); null = not answered yet. */
export type Speeds = readonly (number | null)[];

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

/**
 * The same attempt weighted by the speed each answer was heard at (D73):
 * what passes or fails Day 7. Without speeds, it equals attemptScore.
 */
export function attemptWeightedScore(
  sentences: readonly Sentence[],
  answers: Answers,
  speeds: Speeds = [],
): number {
  return weightedAccuracy(
    sentences.map((sentence, i) =>
      scoreDictation(sentence.en, answers[i] ?? ""),
    ),
    speeds,
  );
}

/** Notes the speed an answer was heard at, alongside recordAnswer. */
export function recordSpeed(
  speeds: Speeds,
  index: number,
  speed: number,
  sentenceCount: number,
): Speeds {
  const list =
    speeds.length === sentenceCount
      ? speeds
      : Array.from({ length: sentenceCount }, (_, i) => speeds[i] ?? null);
  if (list[index] !== null && list[index] !== undefined) return list;
  return list.map((s, i) => (i === index ? speed : s));
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
  /** A created practice's version, fixed for the week when it starts (D44). */
  materialVersion?: number,
): Progress {
  const base = pinVersion(
    progress ?? createProgress(videoId, today),
    materialVersion,
  );
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
  /** The speed this answer was heard at (D73); videos are always 1×. */
  speed: number = DEFAULT_SPEED,
): Progress {
  const record = progress.days[day];
  const answers = record?.answers;
  if (!record || !answers || record.done) return progress;

  const next = recordAnswer(answers, index, answer);
  if (next === answers) return progress;
  const speeds = recordSpeed(record.speeds ?? [], index, speed, answers.length);
  if (nextUnanswered(next) !== -1) {
    return withDay(progress, day, {
      ...record,
      answers: [...next],
      speeds: [...speeds],
    });
  }

  const finished = withDay(progress, day, {
    done: true,
    date: today,
    score: attemptScore(sentences, next),
    weightedScore: attemptWeightedScore(sentences, next, speeds),
    answers: [...next],
    speeds: [...speeds],
  });
  return day === 7 && finished.days[1]?.score !== undefined
    ? settleWeek(finished)
    : finished;
}
