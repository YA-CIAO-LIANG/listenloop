import { parseVoiceId } from "@/lib/ai/types";
import type { TextSourceLanguage } from "./split";

/**
 * A practice before it's saved: what the learner reviews and edits after
 * splitting and translating (roadmap d2). These limits are technical
 * safety caps (D21); plan limits on top of them come in roadmap f.
 */
export const PRACTICE_LIMITS = {
  /** Uploaded text, in characters. */
  textChars: 10_000,
  /** Uploaded file, in bytes (10,000 Chinese characters are ~30 KB). */
  fileBytes: 100_000,
  sentences: 300,
  sentenceChars: 500,
  titleChars: 100,
} as const;

export type DraftSentence = { en: string; zh: string };

export type PracticeDraft = {
  title: string;
  sourceLanguage: TextSourceLanguage;
  /** The voice to generate the audio with, e.g. "us-female". */
  voice: string;
  sentences: DraftSentence[];
};

export const DEFAULT_VOICE = "us-female";

export type DraftProblem =
  | "title"
  | "voice"
  | "no-sentences"
  | "too-many"
  | "sentence-empty"
  | "sentence-too-long";

export type CleanDraftResult =
  | { ok: true; draft: PracticeDraft }
  | { ok: false; problem: DraftProblem; sentence?: number };

const tidy = (text: string) => text.replace(/\s+/g, " ").trim();
const length = (text: string) => [...text].length;

export function isTextSourceLanguage(
  value: unknown,
): value is TextSourceLanguage {
  return value === "en" || value === "zh";
}

/**
 * Checks a draft and tidies its whitespace. Takes `unknown` because it
 * also guards the server action, whose input comes from the browser.
 * `sentence` is the 0-based index of the first sentence with a problem.
 */
export function cleanDraft(input: unknown): CleanDraftResult {
  const draft = input as Partial<Record<keyof PracticeDraft, unknown>> | null;
  const title = typeof draft?.title === "string" ? tidy(draft.title) : "";
  if (!title || length(title) > PRACTICE_LIMITS.titleChars) {
    return { ok: false, problem: "title" };
  }
  if (!isTextSourceLanguage(draft?.sourceLanguage)) {
    return { ok: false, problem: "no-sentences" };
  }
  const voice = typeof draft.voice === "string" ? draft.voice : "";
  if (!parseVoiceId(voice)) return { ok: false, problem: "voice" };
  const list = Array.isArray(draft.sentences) ? draft.sentences : [];
  if (list.length === 0) return { ok: false, problem: "no-sentences" };
  if (list.length > PRACTICE_LIMITS.sentences) {
    return { ok: false, problem: "too-many" };
  }

  const sentences: DraftSentence[] = [];
  for (const [index, item] of list.entries()) {
    const sentence = item as Partial<Record<keyof DraftSentence, unknown>>;
    const en = typeof sentence?.en === "string" ? tidy(sentence.en) : "";
    const zh = typeof sentence?.zh === "string" ? tidy(sentence.zh) : "";
    // English is what's dictated, so it needs a letter or a digit.
    if (!/[\p{L}\p{N}]/u.test(en)) {
      return { ok: false, problem: "sentence-empty", sentence: index };
    }
    if (
      length(en) > PRACTICE_LIMITS.sentenceChars ||
      length(zh) > PRACTICE_LIMITS.sentenceChars
    ) {
      return { ok: false, problem: "sentence-too-long", sentence: index };
    }
    sentences.push({ en, zh });
  }
  return {
    ok: true,
    draft: { title, sourceLanguage: draft.sourceLanguage, voice, sentences },
  };
}

/** The file name without its extension, as a default title. */
export function titleFromFileName(name: string): string {
  return tidy(name.replace(/\.[^.]*$/, "")).slice(
    0,
    PRACTICE_LIMITS.titleChars,
  );
}

const CJK_END = /[\p{Script=Han}　-〿＀-￯]$/u;
const CJK_START = /^[\p{Script=Han}　-〿＀-￯]/u;

/** Two pieces of text as one: Chinese joins directly, English with a space. */
export function joinText(a: string, b: string): string {
  const head = a.trim();
  const tail = b.trim();
  if (!head || !tail) return head || tail;
  return CJK_END.test(head) && CJK_START.test(tail)
    ? head + tail
    : `${head} ${tail}`;
}

/** The review rows with row `index` and the next one merged (e+ 4). */
export function mergeWithNext<T extends DraftSentence>(
  rows: readonly T[],
  index: number,
): T[] {
  const [row, next] = [rows[index], rows[index + 1]];
  if (!row || !next) return [...rows];
  return [
    ...rows.slice(0, index),
    { ...row, en: joinText(row.en, next.en), zh: joinText(row.zh, next.zh) },
    ...rows.slice(index + 2),
  ];
}

/**
 * Where row English can be split: a position with letters or digits on
 * both sides, or null.
 */
export function canSplitAt(en: string, at: number): boolean {
  const content = /[\p{L}\p{N}]/u;
  return content.test(en.slice(0, at)) && content.test(en.slice(at));
}

/**
 * The review rows with row `index` split at character `at` of its English
 * (e+ 4). The first part keeps the Chinese; the new row's Chinese is
 * empty and is translated when the practice is created.
 */
export function splitRowAt<T extends DraftSentence>(
  rows: readonly T[],
  index: number,
  at: number,
  newRow: (en: string) => T,
): T[] {
  const row = rows[index];
  if (!row || !canSplitAt(row.en, at)) return [...rows];
  return [
    ...rows.slice(0, index),
    { ...row, en: row.en.slice(0, at).trim() },
    newRow(row.en.slice(at).trim()),
    ...rows.slice(index + 1),
  ];
}
