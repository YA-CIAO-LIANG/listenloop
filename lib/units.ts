/**
 * Quota units (D209, Joe 2026-11-24): practices one makes are counted in
 * English words, chats in messages. A minute of English read aloud is
 * about WORDS_PER_MINUTE words (measured on the live site: 20,540 words
 * in 135 minutes of audio, 152 a minute), so a practice's estimated
 * seconds and its words convert both ways; usage kept in seconds
 * (practice_creations) is shown and checked in words.
 */
export const WORDS_PER_MINUTE = 150;

/** A short essay, for "about N essays of 150 words" on the pricing page. */
export const WORDS_PER_SHORT_TEXT = 150;

/** Seconds of English read aloud → words. */
export const secondsToWords = (seconds: number): number =>
  Math.round((seconds / 60) * WORDS_PER_MINUTE);

/** Words → seconds of English read aloud (unrounded, for checks). */
export const wordsToSeconds = (words: number): number =>
  (words / WORDS_PER_MINUTE) * 60;
