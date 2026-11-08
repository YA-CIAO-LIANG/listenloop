/**
 * Loop playback in dictation (D90): with "Loop" on, a sentence plays again
 * this long after it ends, until the answer is submitted.
 */
export const LOOP_GAP_MS = 1500;

/** Where the Loop switch is remembered in this browser (a convenience). */
export const LOOP_STORAGE_KEY = "ll-loop:v1";
