/**
 * The library's numbers in one place (D70, D104): how a day's practice
 * time is estimated, the length choices, how many categories can be
 * picked, and the sort orders. Change them here only.
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
} as const;

/**
 * Audio length choices (D104), by `practices.duration_sec`: "all" first
 * (the default), then each range in seconds, both ends included (whole
 * seconds, so ranges meet without a gap). null: no bound on that side.
 */
export const LIBRARY_LENGTHS = [
  { id: "all", min: null, max: null },
  { id: "under-3", min: null, max: 179 },
  { id: "3-5", min: 180, max: 299 },
  { id: "5-10", min: 300, max: 599 },
  { id: "10-plus", min: 600, max: null },
] as const;
export type LibraryLengthId = (typeof LIBRARY_LENGTHS)[number]["id"];

export const isLibraryLengthId = (value: unknown): value is LibraryLengthId =>
  LIBRARY_LENGTHS.some((length) => length.id === value);

/**
 * "How many minutes do I have today" (D127): the library shows materials
 * whose average practice day (lib/library-time.ts) fits. The first filter
 * on the home page.
 */
export const LIBRARY_MINUTES = [5, 10, 15, 20, 30] as const;
export type LibraryMinutes = (typeof LIBRARY_MINUTES)[number];

export const isLibraryMinutes = (value: unknown): value is LibraryMinutes =>
  LIBRARY_MINUTES.includes(value as LibraryMinutes);

/**
 * Categories shown before "More categories" (D127): the ones with the
 * most materials. Chosen ones always show.
 */
export const MAIN_CATEGORY_COUNT = 6;

/** Categories one search may pick (D104). */
export const MAX_CATEGORIES = 5;

/** Wait this long after the last change before searching (D104). */
export const SEARCH_DEBOUNCE_MS = 300;

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
