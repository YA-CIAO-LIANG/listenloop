/**
 * The library's numbers in one place (D70): how a day's practice time is
 * estimated, the "how many minutes do I have today?" choices, and the
 * sort orders. Change them here only.
 */

/**
 * A day's practice takes about this many times the material's length:
 * dictation plays each sentence, replays some, and waits while the
 * learner types; shadowing plays and records each one. Replaced by the
 * measured average once a material has enough practice time logged
 * (MIN_TIMED_SESSIONS, D74).
 */
export const PRACTICE_TIME_FACTOR = 4;

/** Measured averages are trusted from this many timed days on. */
export const MIN_TIMED_SESSIONS = 5;

/** "我今天有幾分鐘？" choices, in minutes. */
export const TIME_BUDGETS = [10, 20, 30] as const;
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
