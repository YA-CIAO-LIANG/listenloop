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
