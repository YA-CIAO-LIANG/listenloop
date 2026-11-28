import type { WritingLevel } from "../types";

/**
 * The learner's own essay, corrected (D218): Days 2–6 practice the
 * learner's Day 1 essay as the AI rewrote it, not a new model essay. One
 * of three levels, and from any version a step easier or harder; the
 * learner compares and chooses the one to practice.
 */
export const REWRITE_LEVELS = ["fix", "natural", "advanced"] as const;
export type RewriteLevel = (typeof REWRITE_LEVELS)[number];

/** The default level (Joe: 「自然」), unless the writing settings say otherwise. */
export const DEFAULT_REWRITE_LEVEL: RewriteLevel = "natural";

export const REWRITE_ADJUSTS = ["easier", "harder"] as const;
export type RewriteAdjust = (typeof REWRITE_ADJUSTS)[number];

/**
 * Versions one essay may have: each is a paid call, counted against the
 * daily and monthly AI allowance like every AI call (D77). Enough for
 * the three levels and a few steps easier or harder.
 */
export const MAX_REWRITE_VERSIONS = 6;

/** Sentences sent at most (a 2,000-word essay is about 120). */
export const MAX_REWRITE_SENTENCES = 120;

export const isRewriteLevel = (v: unknown): v is RewriteLevel =>
  (REWRITE_LEVELS as readonly unknown[]).includes(v);

/** What the model is given: the learner's sentences, as data. */
export type RewriteInput = {
  level: RewriteLevel;
  /** A step easier or harder than the version shown (then in `sentences`). */
  adjust?: RewriteAdjust;
  /** The prompt's level: "slightly above" is measured from it. */
  learner: WritingLevel;
  task: string;
  /**
   * The learner's sentences; with `adjust`, the version shown (what is
   * rewritten), the learner's own then in `original`.
   */
  sentences: { i: number; en: string }[];
  /** With `adjust`: the learner's own sentences, for their meaning. */
  original?: { i: number; en: string }[];
};

/** One sentence of a version: the learner's, and as rewritten. */
export type RewriteSentence = {
  i: number;
  /** Paragraph of the essay (0-based), for writing a paragraph back. */
  p: number;
  original: string;
  revised: string;
  /** The words changed (case and punctuation aside). */
  changed: boolean;
  /** Why it changed, in Chinese ("" when it didn't). */
  why: string;
  /** The revised sentence's meaning in Chinese. */
  zh: string;
};

export type RewriteVersion = {
  id: string;
  level: RewriteLevel;
  /** Made from version `from` by "too hard" / "a bit harder". */
  adjust?: RewriteAdjust;
  from?: string;
  sentences: RewriteSentence[];
  /** Flesch–Kincaid grade of the revised text (lib/writing/readability.ts). */
  grade: number;
  at: string;
};

/**
 * Day 1's essay, corrected (kept with Day 1): every version asked for,
 * and the one chosen for Days 2–6 (its sentences, audio, and drills).
 */
export type EssayRewrite = {
  /** The essay the versions were made from (a changed essay starts over). */
  essay: string;
  versions: RewriteVersion[];
  chosen?: string;
};

/** What Days 2–6 practice: the learner's own corrected essay, or the model essay. */
export type PracticeSource = "own" | "model";
