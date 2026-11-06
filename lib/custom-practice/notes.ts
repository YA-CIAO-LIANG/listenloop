import {
  meteredLanguage,
  type MeteredDeps,
  type MeteredResult,
} from "@/lib/ai/metered";
import {
  annotateBudget,
  segmentBudget,
  translateBudget,
  type LanguageBudget,
} from "@/lib/ai/budgets";
import type { Billed, TextLanguage } from "@/lib/ai/types";
import type { GrammarPoint, VocabItem } from "@/lib/videos";
import { sha256Hex } from "./hash";
import {
  checkedSegments,
  splitLine,
  textLines,
  type TextSourceLanguage,
} from "./split";

/**
 * Teaching notes for created practices (D27): vocabulary and grammar in
 * the same shape as a built-in video's, so dictation feedback and the
 * handout show them the same way. Made by a language model, so every item
 * is checked before it's kept, and results are cached by content.
 */
export type PracticeNotes = { vocab: VocabItem[]; grammar: GrammarPoint[] };

/**
 * Sentences per model call: long texts go in several smaller requests,
 * and each finished chunk moves the progress bar (e+ 2).
 */
export const NOTES_CHUNK = 10;

/** Sentences per translation call while preparing a draft (e+ 2). */
export const TRANSLATE_BATCH = 8;

/** Like the built-in library: at most 2 words and 1 grammar point a sentence. */
export const NOTES_PER_SENTENCE = { vocab: 2, grammar: 1 } as const;

const MAX = { word: 60, pos: 20, zh: 120, point: 120, text: 400 } as const;

export type CacheKind = "translation" | "notes" | "segmentation";

/** Results of language-model calls by content hash; Supabase on the server. */
export interface AiCache {
  get(hash: string): Promise<unknown>;
  set(hash: string, kind: CacheKind, result: unknown): Promise<void>;
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

const cacheHash = (deps: LanguageDeps, kind: string, key: string) =>
  sha256Hex(`${kind}\n${deps.providers.language.id}\n${key}`);

/** A cached result that passes `check`, or null (missing or unreadable). */
async function readCache<T>(
  deps: LanguageDeps,
  hash: string,
  check: (result: unknown) => T | null,
): Promise<T | null> {
  try {
    const stored = await deps.cache.get(hash);
    return stored === null || stored === undefined ? null : check(stored);
  } catch {
    // An unreadable cache only costs a fresh call.
    return null;
  }
}

/**
 * Runs a language-model call once per distinct input: a cached result is
 * returned without calling the provider or counting usage.
 */
async function cachedLanguageCall<T>(
  deps: LanguageDeps,
  kind: CacheKind,
  key: string,
  budget: LanguageBudget,
  call: () => Promise<Billed<unknown>>,
  check: (result: unknown) => T | null,
): Promise<MeteredResult<T>> {
  const hash = await cacheHash(deps, kind, key);
  const cached = await readCache(deps, hash, check);
  if (cached !== null) return { ok: true, value: cached };
  const result = await meteredLanguage(deps, budget, call);
  if (!result.ok) return result;
  const value = check(result.value);
  if (value === null) return { ok: false, reason: "failed" };
  await deps.cache.set(hash, kind, value).catch(() => {});
  return { ok: true, value };
}

/**
 * The text's sentences, split by meaning (e+ 4, D35), cached. The model's
 * answer is checked line by line (checkedSegments); a line it didn't
 * split cleanly, or the whole text when the call fails, is split by the
 * rules instead, so splitting itself never fails. The call counts toward
 * the language-model allowance.
 */
export async function segmentCached(
  deps: LanguageDeps,
  text: string,
  language: TextSourceLanguage,
): Promise<string[]> {
  const lines = textLines(text);
  if (lines.length === 0) return [];
  const result = await cachedLanguageCall<string[][]>(
    deps,
    "segmentation",
    JSON.stringify({ language, lines }),
    segmentBudget(lines),
    () => deps.providers.language.segment(lines, language),
    // Keep the checked sentences per line, so the cache holds clean data.
    (raw) =>
      Array.isArray(raw) && raw.length === lines.length
        ? lines.map((line, i) => checkedSegments([line], [raw[i]], language))
        : null,
  );
  return result.ok
    ? result.value.flat()
    : lines.flatMap((line) => splitLine(line, language));
}

/**
 * One sentence's notes, as stored on practice_sentences.notes and in the
 * cache (D43): a practice's notes without the sentence index.
 */
export type SentenceNotes = {
  vocab: Omit<VocabItem, "sentence">[];
  grammar: Omit<GrammarPoint, "sentence">[];
};

const NO_NOTES: SentenceNotes = { vocab: [], grammar: [] };

/** A practice's notes split by sentence, `count` sentences long. */
export function splitNotes(
  notes: PracticeNotes,
  count: number,
): SentenceNotes[] {
  return Array.from({ length: count }, (_, i) => ({
    vocab: notes.vocab
      .filter((item) => item.sentence === i)
      .map(({ word, pos, zh, example }) => ({ word, pos, zh, example })),
    grammar: notes.grammar
      .filter((point) => point.sentence === i)
      .map(({ point, explanation, example }) => ({
        point,
        explanation,
        example,
      })),
  }));
}

/**
 * Per-sentence notes joined into a practice's, checked again as a whole
 * so a word or grammar point noted on two sentences is kept once.
 */
export function joinNotes(list: readonly SentenceNotes[]): PracticeNotes {
  return cleanNotes(
    {
      vocab: list.flatMap((notes, sentence) =>
        notes.vocab.map((item) => ({ ...item, sentence })),
      ),
      grammar: list.flatMap((notes, sentence) =>
        notes.grammar.map((point) => ({ ...point, sentence })),
      ),
    },
    list.length,
  );
}

/** Stored or cached notes for one sentence, checked; null if unusable. */
export function parseSentenceNotes(value: unknown): SentenceNotes | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.vocab) || !Array.isArray(raw.grammar)) return null;
  const withIndex = (items: unknown[]) =>
    items.map((item) => ({ ...(item as object), sentence: 0 }));
  return splitNotes(
    cleanNotes(
      { vocab: withIndex(raw.vocab), grammar: withIndex(raw.grammar) },
      1,
    ),
    1,
  )[0];
}

/**
 * Translations of `texts`, same length and order, or a failure. Cached a
 * sentence at a time (D43): a sentence translated before, in any
 * practice, costs nothing; only the rest go to the model, in one call.
 */
export async function translateCached(
  deps: LanguageDeps,
  texts: readonly string[],
  languages: { from: TextLanguage; to: TextLanguage },
): Promise<MeteredResult<string[]>> {
  const keyOf = (text: string) => JSON.stringify({ ...languages, text });
  const checkLine = (value: unknown) =>
    typeof value === "string" && value.trim() ? value.trim() : null;
  const hashes = await Promise.all(
    texts.map((text) => cacheHash(deps, "translation", keyOf(text))),
  );
  const found = await Promise.all(
    hashes.map((hash) => readCache(deps, hash, checkLine)),
  );
  const missing = texts.flatMap((_, i) => (found[i] === null ? [i] : []));
  if (missing.length > 0) {
    const asked = missing.map((i) => texts[i]);
    const result = await meteredLanguage(deps, translateBudget(asked), () =>
      deps.providers.language.translate(asked, languages),
    );
    if (!result.ok) return result;
    const lines = Array.isArray(result.value) ? result.value : [];
    const checked = lines.map(checkLine);
    if (lines.length !== asked.length || checked.includes(null)) {
      return { ok: false, reason: "failed" };
    }
    for (const [k, i] of missing.entries()) {
      found[i] = checked[k];
      await deps.cache
        .set(hashes[i], "translation", checked[k])
        .catch(() => {});
    }
  }
  return { ok: true, value: found as string[] };
}

/**
 * Fills in the missing (null) entries of `notes` for `sentences` (D43):
 * each from the cache when that sentence was annotated before, in any
 * practice, else from the model, NOTES_CHUNK missing sentences per call,
 * at most `freshCalls` calls. Returns the notes with what it filled;
 * entries still null are left for a later call. Stops at the first
 * failure, keeping nothing from that call.
 */
export async function annotateMissing(
  deps: LanguageDeps,
  sentences: readonly string[],
  notes: readonly (SentenceNotes | null)[],
  freshCalls: number,
): Promise<MeteredResult<(SentenceNotes | null)[]>> {
  const filled = sentences.map((_, i) => notes[i] ?? null);
  const keyOf = (en: string) => JSON.stringify({ en });
  let calls = 0;
  let pending: number[] = [];

  async function ask(): Promise<MeteredResult<null>> {
    const chunk = pending.map((i) => sentences[i]);
    const result = await meteredLanguage(deps, annotateBudget(chunk), () =>
      deps.providers.language.annotate(chunk),
    );
    if (!result.ok) return result;
    const each = splitNotes(
      cleanNotes(result.value, chunk.length),
      chunk.length,
    );
    for (const [k, i] of pending.entries()) {
      filled[i] = each[k];
      const hash = await cacheHash(deps, "notes", keyOf(sentences[i]));
      await deps.cache.set(hash, "notes", each[k]).catch(() => {});
    }
    calls++;
    pending = [];
    return { ok: true, value: null };
  }

  for (const [i, en] of sentences.entries()) {
    if (filled[i]) continue;
    const hash = await cacheHash(deps, "notes", keyOf(en));
    const cached = await readCache(deps, hash, parseSentenceNotes);
    if (cached) {
      filled[i] = cached;
      continue;
    }
    if (calls >= freshCalls) break;
    pending.push(i);
    if (pending.length === NOTES_CHUNK) {
      const asked = await ask();
      if (!asked.ok) return asked;
    }
  }
  if (pending.length > 0 && calls < freshCalls) {
    const asked = await ask();
    if (!asked.ok) return asked;
  }
  return { ok: true, value: filled };
}

/** All of a practice's notes, as many model calls as it takes. */
export async function annotateSentences(
  deps: LanguageDeps,
  sentences: readonly string[],
): Promise<MeteredResult<PracticeNotes>> {
  const result = await annotateMissing(
    deps,
    sentences,
    sentences.map(() => null),
    Infinity,
  );
  if (!result.ok) return result;
  return {
    ok: true,
    value: joinNotes(result.value.map((notes) => notes ?? NO_NOTES)),
  };
}
