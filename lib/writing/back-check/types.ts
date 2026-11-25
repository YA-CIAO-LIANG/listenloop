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

/**
 * The AI's view of one answer, as kept with it. The two verdicts are the
 * fields (D205): what the learner reads ("meaning: right", "grammar: has
 * a mistake") is made from them, and each note only explains its own
 * verdict; a note that contradicts its field is dropped.
 */
export type BackJudgement = {
  /** Says the same thing as the reference. */
  meaning: boolean;
  /** Correct English (always true for a Chinese answer). */
  grammar: boolean;
  /** A more natural way to say it, or "". */
  better: string;
  /**
   * In Chinese: what changed (meaning false), or why another wording is
   * fine (true); "" when there's nothing to add.
   */
  meaningWhy?: string;
  /** In Chinese: the grammar mistake (grammar false); otherwise "". */
  grammarWhy?: string;
  /** Checks before D205 (prompt version 1): one reason for both. */
  why?: string;
};

/** Where a note and its verdict disagree (D205), for the usage log and the eval. */
export type BackInconsistency = {
  i: number;
  field: "meaning" | "grammar";
  /** "contradicts": the note says the opposite; "missing": a wrong verdict without a note. */
  kind: "contradicts" | "missing";
};

/** Right when the meaning and the grammar are. */
export const judgedRight = (j: BackJudgement) => j.meaning && j.grammar;

/** At most this many answers in one call. */
export const BACK_CHECK_MAX_ITEMS = 8;
/** Longest text of each field sent, in characters. */
export const BACK_CHECK_MAX_CHARS = 300;
