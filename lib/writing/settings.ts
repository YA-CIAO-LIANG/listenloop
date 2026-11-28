/**
 * A learner's writing settings (D194, D195), kept like the rest of their
 * writing: in this browser (ll-writing-settings:v1) and, signed in, in the
 * account's own documents (`writing-settings`). The copy changed last
 * wins.
 */
export const REVIEW_MODES = ["ai", "none"] as const;
export type ReviewMode = (typeof REVIEW_MODES)[number];

/** The daily back-translation drill's three ways (D195). */
export const DICTATION_MODES = [
  "listen-write",
  "read-zh",
  "listen-zh",
] as const;
export type DictationMode = (typeof DICTATION_MODES)[number];

import {
  DEFAULT_REWRITE_LEVEL,
  isRewriteLevel,
  type RewriteLevel,
} from "./rewrite/types";

export type WritingSettings = {
  /** What "submit" does when signed in: AI review, or save only. */
  review: ReviewMode;
  dictation: DictationMode;
  /** Extra practice's answers checked by the AI when signed in (D200). */
  extraAi: boolean;
  /** How sure, asked before each back-translation answer (D202). */
  confidence: boolean;
  /** Hints for a sentence's first tries, fewer each time (D202). */
  scaffold: boolean;
  /** A wrong answer: "where I think it went wrong" first (D202). */
  selfExplain: boolean;
  /** The evening review, and from what time ("HH:MM"), D203. */
  bedtime: boolean;
  bedtimeAt: string;
  /** Day 30's rewrite of a finished cycle's prompt (D203). */
  day30: boolean;
  /** The level Day 1's essay is first rewritten at (D218). */
  rewriteLevel: RewriteLevel;
  /** ISO time of the last change. */
  at: string;
};

export const SETTINGS_KEY = "ll-writing-settings:v1";

export const DEFAULT_WRITING_SETTINGS: WritingSettings = {
  review: "ai",
  dictation: "listen-write",
  extraAi: true,
  confidence: true,
  scaffold: true,
  selfExplain: true,
  bedtime: true,
  bedtimeAt: "21:30",
  day30: true,
  rewriteLevel: DEFAULT_REWRITE_LEVEL,
  at: new Date(0).toISOString(),
};

export function parseWritingSettings(value: unknown): WritingSettings {
  const v = (value && typeof value === "object" ? value : {}) as Record<
    string,
    unknown
  >;
  return {
    review: REVIEW_MODES.find((m) => m === v.review) ?? "ai",
    dictation: DICTATION_MODES.find((m) => m === v.dictation) ?? "listen-write",
    extraAi: v.extraAi !== false,
    confidence: v.confidence !== false,
    scaffold: v.scaffold !== false,
    selfExplain: v.selfExplain !== false,
    bedtime: v.bedtime !== false,
    bedtimeAt:
      typeof v.bedtimeAt === "string" &&
      /^([01]\d|2[0-3]):[0-5]\d$/.test(v.bedtimeAt)
        ? v.bedtimeAt
        : DEFAULT_WRITING_SETTINGS.bedtimeAt,
    day30: v.day30 !== false,
    rewriteLevel: isRewriteLevel(v.rewriteLevel)
      ? v.rewriteLevel
      : DEFAULT_REWRITE_LEVEL,
    at:
      typeof v.at === "string" && !Number.isNaN(Date.parse(v.at))
        ? v.at
        : DEFAULT_WRITING_SETTINGS.at,
  };
}

export const mergeWritingSettings = (
  a: WritingSettings,
  b: WritingSettings,
): WritingSettings => (a.at >= b.at ? a : b);
