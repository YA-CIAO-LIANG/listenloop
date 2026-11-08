import { parseRichNotes } from "./custom-practice/rich-notes";
import { SUBTITLE_MAX } from "./videos";

/**
 * Checks an official material before it's published by a batch (D99):
 * both titles, a subtitle, every sentence translated and voiced, and
 * notes in the current format within their limits. Anything missing
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
  | "noVocabulary";

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
  if (
    sentences.some(
      (s) =>
        !filled(s.zh) ||
        !/\p{Script=Han}/u.test(s.zh!) ||
        s.zh!.trim() === s.en.trim(),
    )
  ) {
    problems.push("translation");
  }
  if (sentences.some((s) => !filled(s.audioPath))) problems.push("audio");
  const notes = sentences.map((s) => parseRichNotes(s.notes, s.en));
  if (notes.some((n) => n === null)) problems.push("notes");
  else if (notes.every((n) => n!.vocab.length === 0)) {
    problems.push("noVocabulary");
  }
  return problems;
}
