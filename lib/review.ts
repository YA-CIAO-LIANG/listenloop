import { addDays, isLocalDate, type LocalDate } from "./dates";
import { missedPieces, missedWords } from "./custom-practice/marks";
import type { Progress } from "./progress";
import { normalizeWords } from "./scoring/normalize";

/**
 * "My misheard words" (D108): the words a learner got wrong in dictation
 * (Day 1 and Day 7), brought back for a short review in today's tasks at
 * spaced intervals. No AI: each review is the original sentence with the
 * word blanked out, its Chinese, and (for audio materials) its audio.
 *
 * - First review the day after it was misheard, then 3 days after that,
 *   then 7 (REVIEW_INTERVALS); three right answers and it's learned.
 * - A wrong answer, or missing it again in dictation, starts it over.
 * - Kept in the activity log (ll-activity:v1, `review`), which already
 *   syncs to the account; devices merge by the latest change per word.
 */
export const REVIEW_INTERVALS = [1, 3, 7] as const;

/** "Loop": the pause between one playing of the word and the next (D145). */
export const REVIEW_LOOP_GAP_MS = 1500;

/** Reviews a day at most, so a long list never turns into a chore. */
export const REVIEW_PER_DAY = 10;

/** Shorter words aren't worth a review on their own. */
export const REVIEW_MIN_LETTERS = 3;

/** Common words a blank can't test: almost any sentence would fit them. */
export const REVIEW_SKIP_WORDS: readonly string[] = [
  "the",
  "and",
  "but",
  "for",
  "you",
  "are",
  "was",
  "his",
  "her",
  "its",
  "our",
  "not",
];
const SKIP_WORDS = new Set(REVIEW_SKIP_WORDS);

/** Where the word was misheard: enough to review it later. */
export type ReviewSource = {
  /** The sentence it was in, and its Chinese. */
  en: string;
  zh: string;
  videoId: string;
  /** The sentence's index in that material. */
  i: number;
  /** The sentence's audio (audio materials); videos have none. */
  audio?: string;
};

export type ReviewWord = ReviewSource & {
  /** Right answers so far; REVIEW_INTERVALS.length means learned. */
  stage: number;
  /** The day it's next due. */
  due: LocalDate;
  /** When it last changed (ISO), so two devices merge to the latest. */
  at: string;
};

/** Lowercased word → its review. */
export type ReviewState = Record<string, ReviewWord>;

/** The word as a key: lowercase, straight apostrophes. */
export const reviewKey = (word: string) =>
  word.toLowerCase().replace(/[‘’]/g, "'");

/** Whether a misheard word is worth reviewing. */
export function reviewable(word: string): boolean {
  const key = reviewKey(word);
  const letters = key.replace(/[^\p{L}]/gu, "").length;
  return letters >= REVIEW_MIN_LETTERS && !SKIP_WORDS.has(key);
}

export type Miss = ReviewSource & { word: string };

/** The words misheard in one sentence's answer, with where they were. */
export function sentenceMisses(source: ReviewSource, answer: string): Miss[] {
  return missedWords(source.en, missedPieces(source.en, answer))
    .filter(reviewable)
    .map((word) => ({ ...source, word }));
}

/**
 * Adds misheard words: each starts over (due the next day) with this
 * sentence as its example. With `onlyNew`, words already in the list are
 * left as they are (for filling the list from older answers).
 */
export function addMisses(
  state: ReviewState,
  misses: readonly Miss[],
  today: LocalDate,
  now: Date,
  { onlyNew = false }: { onlyNew?: boolean } = {},
): ReviewState {
  let next = state;
  for (const { word, ...source } of misses) {
    const key = reviewKey(word);
    if (onlyNew && state[key]) continue;
    next = {
      ...next,
      [key]: {
        ...source,
        stage: 0,
        due: addDays(today, REVIEW_INTERVALS[0]),
        at: now.toISOString(),
      },
    };
  }
  return next;
}

/** Whether the word is learned (passed every review). */
export const isLearned = (review: ReviewWord) =>
  review.stage >= REVIEW_INTERVALS.length;

/** Today's reviews: due and not learned, oldest first, at most a day's. */
export function dueReviews(
  state: ReviewState,
  today: LocalDate,
  limit = REVIEW_PER_DAY,
): [string, ReviewWord][] {
  return Object.entries(state)
    .filter(([, review]) => !isLearned(review) && review.due <= today)
    .sort(([a, x], [b, y]) => x.due.localeCompare(y.due) || a.localeCompare(b))
    .slice(0, limit);
}

/**
 * One answer in a review: right moves the word to its next interval (or
 * learned after the last); wrong starts it over, due tomorrow.
 */
export function recordReview(
  state: ReviewState,
  key: string,
  correct: boolean,
  today: LocalDate,
  now: Date,
): ReviewState {
  const review = state[key];
  if (!review) return state;
  const stage = correct ? review.stage + 1 : 0;
  const interval =
    stage < REVIEW_INTERVALS.length
      ? REVIEW_INTERVALS[stage]
      : REVIEW_INTERVALS[0];
  return {
    ...state,
    [key]: {
      ...review,
      stage,
      due: correct ? addDays(today, interval) : addDays(today, 1),
      at: now.toISOString(),
    },
  };
}

/**
 * Whether the typed answer is the word, compared the way dictation scores
 * (case, punctuation, contractions, and numbers as words: 5 = five).
 */
export function isRightAnswer(answer: string, word: string): boolean {
  const typed = normalizeWords(answer);
  return typed.length > 0 && typed.join(" ") === normalizeWords(word).join(" ");
}

/**
 * The sentence with the word blanked out (its first whole-word match), as
 * the text before and after; null if the word isn't in it.
 */
export function blankOut(
  en: string,
  word: string,
): { before: string; after: string; word: string } | null {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(
    `(^|[^\\p{L}\\p{N}'])(${escaped})(?![\\p{L}\\p{N}])`,
    "iu",
  ).exec(en.replace(/[‘’]/g, "'"));
  if (!match) return null;
  const start = match.index + match[1].length;
  return {
    before: en.slice(0, start),
    word: en.slice(start, start + match[2].length),
    after: en.slice(start + match[2].length),
  };
}

/** Material sentences the review list can be filled from. */
export type ReviewMaterial = {
  sentences: { en: string; zh: string; audio?: string }[];
};

/**
 * The misses in finished Day 1 and Day 7 answers kept in progress, oldest
 * day first, for filling the list with what was misheard before it
 * existed (or on another device). Each comes with the day it happened.
 */
export function missesFromProgress(
  progresses: readonly Progress[],
  materials: Readonly<Record<string, ReviewMaterial>>,
): { date: LocalDate; misses: Miss[] }[] {
  const out: { date: LocalDate; misses: Miss[] }[] = [];
  for (const progress of progresses) {
    const material = materials[progress.videoId];
    if (!material) continue;
    for (const day of [1, 7] as const) {
      const record = progress.days[day];
      if (!record?.done || !record.date) continue;
      const misses = (record.answers ?? []).flatMap((answer, i) => {
        const sentence = material.sentences[i];
        if (typeof answer !== "string" || !sentence) return [];
        return sentenceMisses(
          { ...sentence, videoId: progress.videoId, i },
          answer,
        );
      });
      if (misses.length) out.push({ date: record.date, misses });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Merges two devices' lists: the latest change of each word wins. */
export function mergeReview(a: ReviewState, b: ReviewState): ReviewState {
  const out: ReviewState = { ...a };
  for (const [key, review] of Object.entries(b)) {
    const mine = out[key];
    if (!mine || review.at > mine.at) out[key] = review;
  }
  return out;
}

/** Validates a stored list; malformed entries are dropped. */
export function parseReview(data: unknown): ReviewState | undefined {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return undefined;
  }
  const out: ReviewState = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value !== "object" || value === null) continue;
    const r = value as Record<string, unknown>;
    if (
      typeof r.en === "string" &&
      typeof r.zh === "string" &&
      typeof r.videoId === "string" &&
      Number.isInteger(r.i) &&
      (r.audio === undefined || typeof r.audio === "string") &&
      Number.isInteger(r.stage) &&
      (r.stage as number) >= 0 &&
      isLocalDate(r.due) &&
      typeof r.at === "string"
    ) {
      out[key] = value as ReviewWord;
    }
  }
  return out;
}
