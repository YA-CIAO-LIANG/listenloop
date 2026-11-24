import type { DictationMode } from "../settings";

/**
 * The AI check of extra practice's back-translation answers (D200): only
 * the answers the rules didn't find exactly right, all of a set in one
 * call.
 */
export type BackCheckItem = {
  /** The answer's place in the set. */
  i: number;
  mode: DictationMode;
  /** The English sentence. */
  reference: string;
  /** Its Chinese meaning, or "" when there is none. */
  meaning: string;
  /** What the learner wrote (English, or Chinese for listen-zh). */
  answer: string;
};

export type BackCheckInput = { items: BackCheckItem[] };

/** The AI's view of one answer, as kept with it. */
export type BackJudgement = {
  /** Says the same thing as the reference. */
  meaning: boolean;
  /** Correct English (always true for a Chinese answer). */
  grammar: boolean;
  /** A more natural way to say it, or "". */
  better: string;
  /** Why, in Chinese. */
  why: string;
};

/** Right when the meaning and the grammar are. */
export const judgedRight = (j: BackJudgement) => j.meaning && j.grammar;

/** At most this many answers in one call. */
export const BACK_CHECK_MAX_ITEMS = 8;
/** Longest text of each field sent, in characters. */
export const BACK_CHECK_MAX_CHARS = 300;
