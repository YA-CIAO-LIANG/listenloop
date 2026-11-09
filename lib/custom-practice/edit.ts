import {
  parseSentenceNotes,
  parseStoredNotes,
  type StoredNotes,
} from "./notes";
import { isRichNotes, parseRichNotes } from "./rich-notes";
import type { Speaker } from "./speakers";

/**
 * Editing a created practice (e+ 9c, D45). Saving makes a new version
 * (D44); only what changed is made again: a sentence whose English is
 * unchanged keeps its audio (same voice) and notes, a changed one gets
 * new audio, and new notes and Chinese unless the author wrote them.
 */

/** One sentence as the editor sends it. */
export type EditSentence = {
  en: string;
  /** Empty: translate it again when saving. */
  zh: string;
  /** Null: make new notes after saving (cached by the sentence's text). */
  notes: StoredNotes | null;
  /** In a two-voice dialogue: 0 is A, 1 is B (D57). */
  speaker?: Speaker;
};

export type PracticeEdit = {
  /** The version the editor opened, to catch a save made in between. */
  expectedVersion: number;
  title: string;
  /** Both titles and the subtitle (D83); the server keeps them as typed. */
  titleEn?: string;
  titleZh?: string;
  subtitle?: string;
  voice: string;
  /** Speaker B's voice, for a dialogue (D57). */
  voiceB?: string;
  sentences: EditSentence[];
};

/** A sentence in the editor, with what it was when the editor opened. */
export type EditRow = EditSentence & {
  key: number;
  /** The saved sentence this row started as; null for a new row. */
  original: EditSentence | null;
  /** The author changed this row's notes by hand. */
  notesEdited: boolean;
};

/**
 * What to send for each row: a row whose English changed asks for new
 * Chinese and notes, unless the author edited those too.
 */
export function editSentences(rows: readonly EditRow[]): EditSentence[] {
  return rows.map((row) => {
    const enChanged = !row.original || row.en.trim() !== row.original.en;
    const zhEdited = row.original
      ? row.zh.trim() !== row.original.zh
      : row.zh.trim() !== "";
    return {
      en: row.en,
      zh: enChanged && !zhEdited ? "" : row.zh,
      notes: enChanged && !row.notesEdited ? null : row.notes,
      ...(row.speaker === undefined ? {} : { speaker: row.speaker }),
    };
  });
}

/** The saved sentences as editor rows. */
export function rowsFromSentences(
  sentences: readonly EditSentence[],
  firstKey = 0,
): EditRow[] {
  return sentences.map((sentence, i) => ({
    ...sentence,
    key: firstKey + i,
    original: sentence,
    notesEdited: false,
  }));
}

/** A sentence as saved: what the database function takes. */
export type SavedSentence = {
  en: string;
  zh: string;
  audio_path: string | null;
  notes: StoredNotes | null;
  speaker: Speaker | null;
};

/**
 * The new version's sentences from the edit and the current ones:
 * unchanged English (by exact text) keeps its audio if the voice is the
 * same, and its notes if the edit didn't send any. `translate` lists the
 * sentences whose Chinese is to be made.
 */
export function planEdit(
  current: {
    voice: string | null;
    voiceB?: string | null;
    sentences: readonly {
      en: string;
      audio_path: string | null;
      notes: unknown;
      speaker?: number | null;
    }[];
  },
  edit: {
    voice: string;
    voiceB?: string | null;
    sentences: readonly EditSentence[];
  },
): { sentences: SavedSentence[]; translate: number[] } {
  // The voice a sentence is read in: B's own in a dialogue (D57).
  const voiceOf = (
    practice: { voice: string | null; voiceB?: string | null },
    speaker: number | null | undefined,
  ) => (speaker === 1 && practice.voiceB ? practice.voiceB : practice.voice);
  const before = new Map(current.sentences.map((s) => [s.en, s]));
  const translate: number[] = [];
  const sentences = edit.sentences.map((sentence, i) => {
    const old = before.get(sentence.en);
    if (!sentence.zh) translate.push(i);
    const sameVoice =
      old !== undefined &&
      voiceOf(current, old.speaker) === voiceOf(edit, sentence.speaker);
    return {
      en: sentence.en,
      zh: sentence.zh,
      audio_path: sameVoice ? (old?.audio_path ?? null) : null,
      notes:
        sentence.notes ?? (old ? parseStoredNotes(old.notes, old.en) : null),
      speaker: sentence.speaker ?? null,
    };
  });
  return { sentences, translate };
}

/**
 * Checks each sentence's notes as the browser sent them: null, or notes
 * that keep every item once checked (none dropped as malformed). The
 * index of the first bad one, or null.
 */
export function badNotes(sentences: readonly unknown[]): number | null {
  for (const [i, raw] of sentences.entries()) {
    const notes = (raw as { notes?: unknown } | null)?.notes;
    if (notes === null || notes === undefined) continue;
    const en = (raw as { en?: unknown } | null)?.en;
    // Version 2 notes (D67) are checked against their sentence.
    const checked = isRichNotes(notes)
      ? parseRichNotes(notes, typeof en === "string" ? en : "")
      : parseSentenceNotes(notes);
    const sent = notes as { vocab?: unknown[]; grammar?: unknown[] };
    if (
      !checked ||
      checked.vocab.length !== (sent.vocab?.length ?? -1) ||
      checked.grammar.length !== (sent.grammar?.length ?? -1)
    ) {
      return i;
    }
  }
  return null;
}
