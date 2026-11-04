import {
  meteredLanguage,
  type MeteredDeps,
  type MeteredResult,
} from "@/lib/ai/metered";
import type { TextLanguage } from "@/lib/ai/types";
import { countChars } from "@/lib/usage";
import type { GrammarPoint, VocabItem } from "@/lib/videos";
import { sha256Hex } from "./hash";

/**
 * Teaching notes for created practices (D27): vocabulary and grammar in
 * the same shape as a built-in video's, so dictation feedback and the
 * handout show them the same way. Made by a language model, so every item
 * is checked before it's kept, and results are cached by content.
 */
export type PracticeNotes = { vocab: VocabItem[]; grammar: GrammarPoint[] };

/** Sentences per model call: long texts go in several smaller requests. */
export const NOTES_CHUNK = 40;

/** Like the built-in library: at most 2 words and 1 grammar point a sentence. */
export const NOTES_PER_SENTENCE = { vocab: 2, grammar: 1 } as const;

const MAX = { word: 60, pos: 20, zh: 120, point: 120, text: 400 } as const;

/** Results of language-model calls by content hash; Supabase on the server. */
export interface AiCache {
  get(hash: string): Promise<unknown>;
  set(
    hash: string,
    kind: "translation" | "notes",
    result: unknown,
  ): Promise<void>;
}

const text = (value: unknown, max: number): string | null => {
  if (typeof value !== "string") return null;
  const tidy = value.replace(/\s+/g, " ").trim();
  return tidy && [...tidy].length <= max ? tidy : null;
};

const index = (value: unknown, count: number): number | null =>
  Number.isInteger(value) && (value as number) >= 0 && (value as number) < count
    ? (value as number)
    : null;

const items = (raw: unknown, key: "vocab" | "grammar"): unknown[] => {
  const list =
    typeof raw === "object" && raw !== null
      ? (raw as Record<string, unknown>)[key]
      : undefined;
  return Array.isArray(list) ? list : [];
};

/**
 * Keeps the well-formed items of a model's notes for `count` sentences
 * and drops the rest: missing or overlong fields, sentence indexes out of
 * range, repeats (by word or grammar point, which the handout uses as
 * keys), and items past the per-sentence limits. `offset` shifts the
 * indexes when the notes cover a later chunk of the practice.
 */
export function cleanNotes(
  raw: unknown,
  count: number,
  offset = 0,
): PracticeNotes {
  const vocab: VocabItem[] = [];
  const grammar: GrammarPoint[] = [];
  const perSentence = new Map<string, number>();
  const seen = new Set<string>();
  const allow = (kind: "vocab" | "grammar", sentence: number, key: string) => {
    const counter = `${kind}:${sentence}`;
    const used = perSentence.get(counter) ?? 0;
    const seenKey = `${kind}:${key.toLowerCase()}`;
    if (used >= NOTES_PER_SENTENCE[kind] || seen.has(seenKey)) return false;
    perSentence.set(counter, used + 1);
    seen.add(seenKey);
    return true;
  };

  for (const item of items(raw, "vocab")) {
    const row = (item ?? {}) as Record<string, unknown>;
    const sentence = index(row.sentence, count);
    const word = text(row.word, MAX.word);
    const pos = text(row.pos, MAX.pos);
    const zh = text(row.zh, MAX.zh);
    const example = text(row.example, MAX.text);
    if (sentence === null || !word || !pos || !zh || !example) continue;
    if (!allow("vocab", sentence, word)) continue;
    vocab.push({ sentence: sentence + offset, word, pos, zh, example });
  }
  for (const item of items(raw, "grammar")) {
    const row = (item ?? {}) as Record<string, unknown>;
    const sentence = index(row.sentence, count);
    const point = text(row.point, MAX.point);
    const explanation = text(row.explanation, MAX.text);
    const example = text(row.example, MAX.text);
    if (sentence === null || !point || !explanation || !example) continue;
    if (!allow("grammar", sentence, point)) continue;
    grammar.push({ sentence: sentence + offset, point, explanation, example });
  }
  return { vocab, grammar };
}

/** Stored notes back from the database, checked like fresh ones. */
export function storedNotes(
  vocab: unknown,
  grammar: unknown,
  count: number,
): PracticeNotes {
  return cleanNotes({ vocab, grammar }, count);
}

type LanguageDeps = MeteredDeps & { cache: AiCache };

/**
 * Runs a language-model call once per distinct input: a cached result is
 * returned without calling the provider or counting usage.
 */
async function cachedLanguageCall<T>(
  deps: LanguageDeps,
  kind: "translation" | "notes",
  key: string,
  chars: number,
  call: () => Promise<T>,
  check: (result: unknown) => T | null,
): Promise<MeteredResult<T>> {
  const hash = await sha256Hex(
    `${kind}\n${deps.providers.language.id}\n${key}`,
  );
  try {
    const stored = await deps.cache.get(hash);
    const cached =
      stored === null || stored === undefined ? null : check(stored);
    if (cached !== null) return { ok: true, value: cached };
  } catch {
    // An unreadable cache only costs a fresh call.
  }
  const result = await meteredLanguage(deps, chars, call);
  if (!result.ok) return result;
  const value = check(result.value);
  if (value === null) return { ok: false, reason: "failed" };
  await deps.cache.set(hash, kind, value).catch(() => {});
  return { ok: true, value };
}

/** Translations of `texts`, cached; same length and order, or a failure. */
export function translateCached(
  deps: LanguageDeps,
  texts: readonly string[],
  languages: { from: TextLanguage; to: TextLanguage },
): Promise<MeteredResult<string[]>> {
  if (texts.length === 0) return Promise.resolve({ ok: true, value: [] });
  return cachedLanguageCall(
    deps,
    "translation",
    JSON.stringify({ ...languages, texts }),
    countChars(texts),
    () => deps.providers.language.translate(texts, languages),
    (result) =>
      Array.isArray(result) &&
      result.length === texts.length &&
      result.every((line) => typeof line === "string" && line.trim())
        ? (result as string[]).map((line) => line.trim())
        : null,
  );
}

/**
 * Notes for a practice's English sentences, NOTES_CHUNK at a time, each
 * chunk cached. Stops at the first chunk that fails; a retry reuses the
 * chunks already cached. Repeats across chunks are dropped at the end.
 */
export async function annotateSentences(
  deps: LanguageDeps,
  sentences: readonly string[],
): Promise<MeteredResult<PracticeNotes>> {
  const parts: PracticeNotes[] = [];
  for (let start = 0; start < sentences.length; start += NOTES_CHUNK) {
    const chunk = sentences.slice(start, start + NOTES_CHUNK);
    const result = await cachedLanguageCall(
      deps,
      "notes",
      JSON.stringify(chunk),
      countChars(chunk),
      () => deps.providers.language.annotate(chunk),
      (raw) => cleanNotes(raw, chunk.length),
    );
    if (!result.ok) return result;
    parts.push(cleanNotes(result.value, chunk.length, start));
  }
  // Each chunk is clean on its own; clean the whole for repeats across chunks.
  return {
    ok: true,
    value: cleanNotes(
      {
        vocab: parts.flatMap((part) => part.vocab),
        grammar: parts.flatMap((part) => part.grammar),
      },
      sentences.length,
    ),
  };
}
