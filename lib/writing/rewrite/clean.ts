import { normalizeWords } from "../../scoring/normalize";
import { gradeLevel } from "../readability";
import {
  MAX_REWRITE_SENTENCES,
  type RewriteInput,
  type RewriteSentence,
} from "./types";

/**
 * The learner's essay as sentences (D218), each with its paragraph:
 * paragraphs by line breaks, sentences by end punctuation, keeping
 * "Dr." and "e.g." in their sentence (like back-translation's split).
 */
const SENTENCE_END =
  /(?<!\b(?:Mr|Ms|Mrs|Dr|St|vs|etc|e\.g|i\.e)\.)(?<=[.!?])\s+(?=[A-Z0-9"“(]|i\s)/;

export function essaySentences(
  essay: string,
): { i: number; p: number; en: string }[] {
  const out: { i: number; p: number; en: string }[] = [];
  essay
    .split(/\n\s*\n|\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => /[A-Za-z]/.test(paragraph))
    .forEach((paragraph, p) => {
      for (const en of paragraph.split(SENTENCE_END)) {
        const sentence = en.trim();
        if (/[A-Za-z]/.test(sentence) && out.length < MAX_REWRITE_SENTENCES) {
          out.push({ i: out.length, p, en: sentence.slice(0, 600) });
        }
      }
    });
  return out;
}

export type RewriteDeclined = "ghostwrite" | "off-task";

export type CleanRewrite =
  | { ok: true; sentences: RewriteSentence[]; grade: number; missing: number[] }
  | { ok: false; declined?: RewriteDeclined };

const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const CJK = /[㐀-鿿]/;
const same = (a: string, b: string) =>
  normalizeWords(a).join(" ") === normalizeWords(b).join(" ");

/** Most words a rewritten sentence may have, from the original's. */
export const maxRevisedWords = (originalWords: number) =>
  Math.round(originalWords * 2.5) + 12;

/**
 * The model's answer made safe to store and show (D218):
 * - one sentence per sentence sent, by `i`; a missing or unusable one
 *   keeps the learner's own words (listed in `missing`);
 * - a revision far longer than the sentence (added content) is dropped;
 * - "why" only where the words changed, and only in Chinese;
 * - "zh" only in Chinese (else empty).
 */
export function cleanRewrite(
  raw: unknown,
  input: Pick<RewriteInput, "sentences">,
  paragraphs: Map<number, number>,
): CleanRewrite {
  if (!raw || typeof raw !== "object") return { ok: false };
  const r = raw as Record<string, unknown>;
  if (r.declined === "ghostwrite" || r.declined === "off-task") {
    return { ok: false, declined: r.declined };
  }
  const items = new Map<number, Record<string, unknown>>();
  for (const item of Array.isArray(r.items) ? r.items : []) {
    if (item && typeof item === "object") {
      const i = Number((item as { i?: unknown }).i);
      if (Number.isInteger(i) && !items.has(i)) {
        items.set(i, item as Record<string, unknown>);
      }
    }
  }
  const missing: number[] = [];
  const sentences = input.sentences.map(({ i, en }) => {
    const item = items.get(i);
    let revised = text(item?.revised, 800);
    const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
    if (
      !/[A-Za-z]/.test(revised) ||
      words(revised) > maxRevisedWords(words(en))
    ) {
      missing.push(i);
      revised = en;
    }
    const changed = !same(en, revised);
    const why = text(item?.why, 300);
    const zh = text(item?.zh, 300);
    return {
      i,
      p: paragraphs.get(i) ?? 0,
      original: en,
      revised,
      changed,
      why: changed && CJK.test(why) ? why : "",
      zh: CJK.test(zh) ? zh : "",
    };
  });
  if (missing.length === input.sentences.length) return { ok: false };
  return {
    ok: true,
    sentences,
    grade: gradeLevel(sentences.map((s) => s.revised).join(" ")),
    missing,
  };
}

/** A version's text by paragraph, as the learner wrote it out. */
export function versionParagraphs(
  sentences: readonly Pick<RewriteSentence, "p" | "revised">[],
): string[] {
  const out: string[] = [];
  for (const s of sentences) {
    out[s.p] = out[s.p] ? `${out[s.p]} ${s.revised}` : s.revised;
  }
  return out.filter(Boolean);
}
