/**
 * The library's numbers in one place (D70): how a day's practice time is
 * estimated, the "how many minutes do I have today?" choices, and the
 * sort orders. Change them here only.
 */

/**
 * How long a day's practice takes (D98, Joe's formula): dictation plays
 * each sentence, replays some, and waits while the learner types, about
 * the material's length × 4 plus 10 seconds a sentence; shadowing plays
 * and records each one, about the length × 3. A week is 2 dictation days
 * and 5 shadowing days; the card shows the week's average day.
 */
export const DAILY_TIME = {
  dictationFactor: 4,
  dictationSecondsPerSentence: 10,
  shadowingFactor: 3,
  /**
   * From this many timed days on (D74), the learner's own pace (measured
   * time ÷ estimate) scales every estimate, within these bounds.
   */
  minTimedDays: 5,
  minPace: 0.5,
  maxPace: 3,
} as const;

/** "我今天有幾分鐘？" choices, in minutes (D98). */
export const TIME_BUDGETS = [5, 10, 15, 20, 30] as const;
export type TimeBudget = (typeof TIME_BUDGETS)[number];

/** Sort orders, in display order; the first is the default. */
export const LIBRARY_SORTS = [
  "recommended",
  "newest",
  "shortest",
  "popular",
] as const;
export type LibrarySort = (typeof LIBRARY_SORTS)[number];

/**
 * Seconds of speech in a voiced file of this many bytes. Azure Speech
 * writes 48 kbit/s MP3 (lib/ai/azure-speech.ts); WAV is 24 kHz, 16-bit
 * mono after a 44-byte header. Good enough for an estimate.
 */
export function audioSeconds(bytes: number, mimeType: string): number {
  return mimeType === "audio/wav"
    ? Math.max(0, bytes - 44) / 48_000
    : (bytes * 8) / 48_000;
}

/**
 * "My default filter" (D98): user_documents key when signed in, browser
 * storage key when not. Applied when the home page opens without a filter
 * in its URL.
 */
export const LIBRARY_DEFAULT_DOCUMENT = "library-default";
export const LIBRARY_DEFAULT_STORAGE_KEY = "ll-library-default:v1";
