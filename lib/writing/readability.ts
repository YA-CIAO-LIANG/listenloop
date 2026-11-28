/**
 * Readability (D218): the Flesch–Kincaid grade level, for telling a
 * rewritten essay's versions apart ("too hard" must come back easier)
 * in the eval and on the version cards. A rough measure on purpose:
 * longer sentences and longer words read harder. Syllables are counted
 * by vowel groups (a silent final "e" aside), which is close enough for
 * comparing two versions of the same text.
 */
export function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const trimmed = w
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "")
    .replace(/^y/, "");
  const groups = trimmed.match(/[aeiouy]+/g);
  return Math.max(1, groups?.length ?? 1);
}

const WORD = /[A-Za-z][A-Za-z'-]*/g;

/** Words, sentences, and syllables of an English text. */
export function textStats(text: string) {
  const words = text.match(WORD) ?? [];
  const sentences = Math.max(
    1,
    text.split(/[.!?]+(?:\s|$)/).filter((s) => /[A-Za-z]/.test(s)).length,
  );
  const syl = words.reduce((n, w) => n + syllables(w), 0);
  return { words: words.length, sentences, syllables: syl };
}

/** Flesch–Kincaid grade level (0 for an empty text), one decimal. */
export function gradeLevel(text: string): number {
  const { words, sentences, syllables: syl } = textStats(text);
  if (words === 0) return 0;
  const grade = 0.39 * (words / sentences) + 11.8 * (syl / words) - 15.59;
  return Math.round(grade * 10) / 10;
}
