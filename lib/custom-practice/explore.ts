import type { TextSourceLanguage } from "./split";

/**
 * Browsing the practices people made public (roadmap e1, D30): what a
 * card shows, and the search and filters, which run in the browser over
 * the list the server sent (it's small; see PUBLIC_PRACTICES_LIMIT).
 */
export type PublicPracticeSummary = {
  /** "p-<uuid>", the id in practice links. */
  id: string;
  title: string;
  sourceLanguage: TextSourceLanguage;
  /** Voice id, e.g. "us-female", or null if it couldn't be read. */
  voice: string | null;
  sentenceCount: number;
  /** ISO time it was created; the list is newest first. */
  createdAt: string;
  /** Made by the viewer. */
  mine: boolean;
};

/** The newest this many public practices are listed. */
export const PUBLIC_PRACTICES_LIMIT = 200;

/**
 * Length by number of sentences: created practices have no timestamps,
 * and each sentence is one dictation and shadowing item. Each bucket
 * includes `min` and `max` (null: no upper end).
 */
export const SENTENCE_BUCKETS = [
  { id: "short", min: 1, max: 10 },
  { id: "medium", min: 11, max: 30 },
  { id: "long", min: 31, max: null },
] as const;

export type SentenceBucketId = (typeof SENTENCE_BUCKETS)[number]["id"];

export function sentenceBucket(count: number): SentenceBucketId | null {
  const bucket = SENTENCE_BUCKETS.find(
    ({ min, max }) => count >= min && (max === null || count <= max),
  );
  return bucket?.id ?? null;
}

export type ExploreFilter = {
  query: string;
  /** Several can be on; none means all. */
  languages: readonly TextSourceLanguage[];
  lengths: readonly SentenceBucketId[];
};

export const NO_FILTER: ExploreFilter = {
  query: "",
  languages: [],
  lengths: [],
};

/** Lowercased, with runs of spaces as one, for matching titles. */
const normalize = (text: string) =>
  text.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * The practices that match: every word of the query appears in the title
 * (any order, any case, full-width letters too), and the source language
 * and length are among the ones chosen.
 */
export function filterPublicPractices(
  practices: readonly PublicPracticeSummary[],
  { query, languages, lengths }: ExploreFilter,
): PublicPracticeSummary[] {
  const words = normalize(query).split(" ").filter(Boolean);
  return practices.filter((practice) => {
    const title = normalize(practice.title);
    if (!words.every((word) => title.includes(word))) return false;
    if (languages.length > 0 && !languages.includes(practice.sourceLanguage)) {
      return false;
    }
    const bucket = sentenceBucket(practice.sentenceCount);
    return (
      lengths.length === 0 || (bucket !== null && lengths.includes(bucket))
    );
  });
}
