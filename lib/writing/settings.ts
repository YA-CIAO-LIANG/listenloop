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

export type WritingSettings = {
  /** What "submit" does when signed in: AI review, or save only. */
  review: ReviewMode;
  dictation: DictationMode;
  /** Extra practice's answers checked by the AI when signed in (D200). */
  extraAi: boolean;
  /** ISO time of the last change. */
  at: string;
};

export const SETTINGS_KEY = "ll-writing-settings:v1";

export const DEFAULT_WRITING_SETTINGS: WritingSettings = {
  review: "ai",
  dictation: "listen-write",
  extraAi: true,
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
