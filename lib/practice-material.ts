import type { Attribution, Video } from "./videos";

/**
 * What the practice pages need (dictation, shadowing, handout, the 7-day
 * cycle): a built-in video, or a practice the learner created, whose
 * sentences each have their own audio file (D23). A Video already is one.
 */
export type PracticeMaterial = Pick<
  Video,
  "id" | "title" | "sentences" | "vocab" | "grammar"
> & {
  /** Built-in videos credit their source; created practices have none. */
  attribution?: Attribution;
} & (
    | { youtubeId: string; audioUrls?: undefined }
    | {
        youtubeId?: undefined;
        /** One file per sentence, in sentence order. */
        audioUrls: string[];
      }
  );

/**
 * Created practices use "p-<uuid>" as their id everywhere a video id goes
 * (progress, links like /videos/<id>/day/1, cloud sync), so the cycle code
 * treats both alike. Built-in video ids may not start with "p-".
 */
export const CUSTOM_PRACTICE_PREFIX = "p-";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function customPracticeId(uuid: string): string {
  return `${CUSTOM_PRACTICE_PREFIX}${uuid}`;
}

/** The practice's database id, or null if `id` isn't a created practice. */
export function parseCustomPracticeId(id: string): string | null {
  if (!id.startsWith(CUSTOM_PRACTICE_PREFIX)) return null;
  const uuid = id.slice(CUSTOM_PRACTICE_PREFIX.length);
  return UUID.test(uuid) ? uuid : null;
}

export const isCustomPracticeId = (id: string) =>
  parseCustomPracticeId(id) !== null;

export type CustomPracticeRow = {
  id: string;
  title: string;
  practice_sentences: {
    i: number;
    en: string;
    zh: string;
    audio_path: string | null;
  }[];
};

/**
 * A created practice as practice material, or null until every sentence
 * has audio (it can't be practiced before then).
 */
export function materialFromCustomPractice(
  row: CustomPracticeRow,
  audioUrl: (path: string) => string | null,
): PracticeMaterial | null {
  const rows = [...row.practice_sentences].sort((a, b) => a.i - b.i);
  const audioUrls: string[] = [];
  for (const sentence of rows) {
    const url = sentence.audio_path && audioUrl(sentence.audio_path);
    if (!url) return null;
    audioUrls.push(url);
  }
  if (rows.length === 0) return null;
  return {
    id: customPracticeId(row.id),
    title: row.title,
    // Each sentence is its own file, so there are no timestamps to keep.
    sentences: rows.map((s, i) => ({
      i,
      start: 0,
      end: 0,
      en: s.en,
      zh: s.zh,
    })),
    vocab: [],
    grammar: [],
    audioUrls,
  };
}

/**
 * The language to mark a title with: built-in video titles are English;
 * a created practice's title is whatever the learner typed.
 */
export function titleLang(id: string): "en" | undefined {
  return isCustomPracticeId(id) ? undefined : "en";
}
