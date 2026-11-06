import { storedNotes } from "./custom-practice/notes";
import { isUuid } from "./custom-practice/organize";
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
  /** A created practice the viewer made (others' are public ones, D30). */
  mine?: boolean;
  /**
   * A created practice's version (D44); a week keeps the version it
   * started with. Built-in videos have none.
   */
  version?: number;
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

export function customPracticeId(uuid: string): string {
  return `${CUSTOM_PRACTICE_PREFIX}${uuid}`;
}

/** The practice's database id, or null if `id` isn't a created practice. */
export function parseCustomPracticeId(id: string): string | null {
  if (!id.startsWith(CUSTOM_PRACTICE_PREFIX)) return null;
  const uuid = id.slice(CUSTOM_PRACTICE_PREFIX.length);
  return isUuid(uuid) ? uuid : null;
}

export const isCustomPracticeId = (id: string) =>
  parseCustomPracticeId(id) !== null;

export type CustomPracticeRow = {
  id: string;
  title: string;
  /** Missing on rows read before versions existed: version 1. */
  version?: number;
  vocab: unknown;
  grammar: unknown;
  notes_generated_at: string | null;
  practice_sentences: {
    i: number;
    en: string;
    zh: string;
    audio_path: string | null;
  }[];
};

/**
 * A created practice as practice material, or null until its notes are
 * made and every sentence has audio (it can't be practiced before then).
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
  if (rows.length === 0 || !row.notes_generated_at) return null;
  const notes = storedNotes(row.vocab, row.grammar, rows.length);
  return {
    id: customPracticeId(row.id),
    title: row.title,
    version: row.version ?? 1,
    // Each sentence is its own file, so there are no timestamps to keep.
    sentences: rows.map((s, i) => ({
      i,
      start: 0,
      end: 0,
      en: s.en,
      zh: s.zh,
    })),
    vocab: notes.vocab,
    grammar: notes.grammar,
    audioUrls,
  };
}

/** How far a created practice's preparation got (notes, then audio). */
export type CustomPracticeReadiness = {
  notesReady: boolean;
  /** Sentences that have audio. */
  voiced: number;
  total: number;
};

export function customPracticeReadiness(
  row: Pick<CustomPracticeRow, "notes_generated_at" | "practice_sentences">,
): CustomPracticeReadiness {
  return {
    notesReady: row.notes_generated_at !== null,
    voiced: row.practice_sentences.filter((s) => s.audio_path).length,
    total: row.practice_sentences.length,
  };
}

/**
 * The language to mark a title with: built-in video titles are English;
 * a created practice's title is whatever the learner typed.
 */
export function titleLang(id: string): "en" | undefined {
  return isCustomPracticeId(id) ? undefined : "en";
}

/**
 * Search engines index built-in videos but not practices people made
 * (D30): spread into a practice page's metadata.
 */
export function practiceRobots(material: PracticeMaterial) {
  return material.youtubeId
    ? {}
    : { robots: { index: false, follow: false } as const };
}

/** Metadata for a practice page shown as "still preparing" (D32). */
export function preparingMetadata(practice: { title: string }) {
  return {
    title: practice.title,
    robots: { index: false, follow: false } as const,
  };
}

/** A stored snapshot of an earlier version (practice_versions, D44). */
export type PracticeVersionRow = {
  practice_id: string;
  version: number;
  title: string;
  sentences: unknown;
  vocab: unknown;
  grammar: unknown;
};

/**
 * An earlier version of a created practice as material, or null if the
 * snapshot is unusable. Snapshots are only taken of practicable versions,
 * so every sentence has its audio and the notes are made.
 */
export function materialFromSnapshot(
  snapshot: PracticeVersionRow,
  audioUrl: (path: string) => string | null,
): PracticeMaterial | null {
  if (!Array.isArray(snapshot.sentences)) return null;
  const sentences = snapshot.sentences.map((raw, i) => {
    const s = (raw ?? {}) as Record<string, unknown>;
    return {
      i,
      en: typeof s.en === "string" ? s.en : "",
      zh: typeof s.zh === "string" ? s.zh : "",
      audio_path: typeof s.audio_path === "string" ? s.audio_path : null,
    };
  });
  if (sentences.some((s) => !s.en)) return null;
  return materialFromCustomPractice(
    {
      id: snapshot.practice_id,
      title: snapshot.title,
      version: snapshot.version,
      vocab: snapshot.vocab,
      grammar: snapshot.grammar,
      // Snapshots are of finished versions.
      notes_generated_at: "snapshot",
      practice_sentences: sentences,
    },
    audioUrl,
  );
}

/**
 * The version in a page's ?v= (D44): a positive integer, or undefined
 * for the latest.
 */
export function parseVersionParam(value: unknown): number | undefined {
  if (typeof value !== "string" || !/^[1-9]\d{0,5}$/.test(value)) {
    return undefined;
  }
  return Number(value);
}

/**
 * Which version a page should show instead of `shown` (D44), for a week
 * fixed to `pinned`, or null to stay. `asked` is the page's ?v=: once it
 * already asks for the pinned version, the page stays even if that
 * version wasn't kept (it then shows the latest), so it never loops.
 */
export function versionToShow(
  pinned: number | undefined,
  shown: number | undefined,
  asked: string | null,
): number | null {
  if (pinned === undefined || shown === undefined || pinned === shown) {
    return null;
  }
  return asked === String(pinned) ? null : pinned;
}
