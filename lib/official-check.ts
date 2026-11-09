import {
  hasFullWidth,
  inconsistentNames,
  materialNames,
  onlyNames,
  textLength,
} from "./content-fixes";
import { parseRichNotes } from "./custom-practice/rich-notes";
import { LONG_NOTES_CHARS } from "./official-audit";
import { SUBTITLE_MAX } from "./videos";

/**
 * Checks an official material before it's published by a batch (D99):
 * both titles, a subtitle, every sentence translated and voiced, and
 * notes in the current format within their limits; since the quality
 * audit (D117), also half-width digits and letters in the Chinese, names
 * written one way, and notes short enough to read. Anything missing
 * keeps it a draft for Joe to look at; the problems say what.
 */
export type OfficialCandidate = {
  titleEn: string | null;
  titleZh: string | null;
  subtitle: string | null;
  sentences: {
    en: string;
    zh: string | null;
    audioPath: string | null;
    notes: unknown;
    /** Played from a YouTube video at its own times (D118): no audio. */
    timed?: boolean;
  }[];
};

export type OfficialProblem =
  | "titleEn"
  | "titleZh"
  | "subtitle"
  | "tooFewSentences"
  | "translation"
  | "audio"
  | "notes"
  | "noVocabulary"
  | "fullWidth"
  | "names"
  | "longNotes";

/** At least this many sentences make a lesson. */
export const MIN_OFFICIAL_SENTENCES = 3;

export function officialProblems(
  candidate: OfficialCandidate,
): OfficialProblem[] {
  const problems: OfficialProblem[] = [];
  const filled = (text: string | null) => !!text && text.trim() !== "";
  if (
    !filled(candidate.titleEn) ||
    /\p{Script=Han}/u.test(candidate.titleEn!)
  ) {
    problems.push("titleEn");
  }
  if (
    !filled(candidate.titleZh) ||
    !/\p{Script=Han}/u.test(candidate.titleZh!)
  ) {
    problems.push("titleZh");
  }
  if (
    !filled(candidate.subtitle) ||
    [...candidate.subtitle!].length > SUBTITLE_MAX
  ) {
    problems.push("subtitle");
  }
  const { sentences } = candidate;
  if (sentences.length < MIN_OFFICIAL_SENTENCES)
    problems.push("tooFewSentences");
  // A line that's only a name ("Emo?") is translated as the name (D118).
  const names = materialNames(sentences);
  if (
    sentences.some(
      (s) =>
        !filled(s.zh) ||
        (!onlyNames(s.en, names) &&
          (!/\p{Script=Han}/u.test(s.zh!) || s.zh!.trim() === s.en.trim())),
    )
  ) {
    problems.push("translation");
  }
  if (sentences.some((s) => !s.timed && !filled(s.audioPath))) {
    problems.push("audio");
  }
  const notes = sentences.map((s) => parseRichNotes(s.notes, s.en));
  if (notes.some((n) => n === null)) problems.push("notes");
  else if (notes.every((n) => n!.vocab.length === 0)) {
    problems.push("noVocabulary");
  }
  if (
    [candidate.titleZh, candidate.subtitle, ...sentences.map((s) => s.zh)].some(
      (text) => !!text && hasFullWidth(text),
    )
  ) {
    problems.push("fullWidth");
  }
  if (inconsistentNames(sentences).length > 0) problems.push("names");
  if (sentences.some((s) => textLength(s.notes) > LONG_NOTES_CHARS)) {
    problems.push("longNotes");
  }
  return problems;
}
