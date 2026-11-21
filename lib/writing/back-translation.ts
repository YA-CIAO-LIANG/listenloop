import { normalizeWords } from "../scoring/normalize";
import { scoreDictation } from "../scoring/dictation";
import type { DictationMode } from "./settings";
import { fixInContext, splitSentences } from "./drills";
import type { WritingFeedback } from "./feedback";
import type { WritingPrompt } from "./types";

/**
 * The daily "back-translation" drill (聽寫回譯, D195), days 2–6 by
 * default: 5–8 sentences a day, heard or read, written back. Rule-checked
 * like ListenLoop's dictation (lib/scoring); no AI.
 *
 * Sentences:
 * - AI-reviewed Day 1: the learner's own sentences as corrected (with
 *   the AI's Chinese meaning), then the model essay's key sentences (its
 *   patterns' examples, then the rest);
 * - no review: the model essay's sentences;
 * - a custom prompt (no model essay, D196): the corrected sentences, or
 *   without a review the learner's own sentences.
 */
export type BackItem = {
  en: string;
  /** The meaning in Chinese, when known (needed for two of the modes). */
  zh?: string;
  source: "fix" | "model" | "own";
};

/** Sentences a day: at least, by default, and at most (D195). */
export const BACK_MIN = 5;
export const BACK_PER_DAY = 6;
export const BACK_MAX = 8;
/** Of the day's sentences, at most this many are the learner's fixes. */
export const BACK_FIXES_PER_DAY = 3;
/** Sentences longer than this are too long to write back from memory. */
export const BACK_MAX_WORDS = 30;
const BACK_MIN_WORDS = 3;

/** A sentence written back right when its accuracy reaches this. */
export const BACK_PASS = 0.8;
/** Chinese meaning: enough of the reference's character pairs. */
export const MEANING_PASS = 0.4;

/** Sentence-ending split that keeps "Dr." and "e.g." in their sentence. */
const SENTENCE_END =
  /(?<!\b(?:Mr|Ms|Mrs|Dr|St|vs|etc|e\.g|i\.e)\.)(?<=[.!?])\s+(?=[A-Z"“(])/;

const splitEn = (paragraph: string) =>
  paragraph
    .trim()
    .split(SENTENCE_END)
    .map((s) => s.trim())
    .filter(Boolean);

const splitZh = (paragraph: string) =>
  (paragraph.trim().match(/[^。！？]+[。！？]?/g) ?? [])
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * The model essay sentence by sentence with its Chinese: the paragraphs
 * split alike (the data's check makes the counts match, D195).
 */
export function modelSentences(
  prompt: Pick<WritingPrompt, "model">,
): { en: string; zh?: string }[] {
  return prompt.model.en.flatMap((paragraph, p) => {
    const en = splitEn(paragraph);
    const zh = splitZh(prompt.model.zh[p] ?? "");
    return en.map((sentence, i) => ({
      en: sentence,
      ...(zh.length === en.length ? { zh: zh[i] } : {}),
    }));
  });
}

/** Whether every model paragraph splits into as many Chinese sentences. */
export function modelSentencesAligned(
  prompt: Pick<WritingPrompt, "model">,
): boolean {
  return prompt.model.en.every(
    (paragraph, p) =>
      splitEn(paragraph).length === splitZh(prompt.model.zh[p] ?? "").length,
  );
}

const fitting = (en: string) => {
  const words = en.split(/\s+/).filter(Boolean).length;
  return words >= BACK_MIN_WORDS && words <= BACK_MAX_WORDS;
};

function unique(items: BackItem[]): BackItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = normalizeWords(item.en).join(" ");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** The learner's sentences as corrected by the AI, with their meaning. */
export function fixedSentences(
  essay: string,
  feedback: WritingFeedback | undefined,
): BackItem[] {
  if (!feedback || feedback.declined) return [];
  return unique(
    [...feedback.issues, ...feedback.more]
      .filter((issue) => issue.quote && issue.suggestion)
      .map((issue) => ({
        en: fixInContext(essay, issue).fixed.trim(),
        ...(issue.zh ? { zh: issue.zh } : {}),
        source: "fix" as const,
      }))
      .filter((item) => fitting(item.en)),
  );
}

/** The model's key sentences first: the ones its patterns come from. */
function modelPool(prompt: Pick<WritingPrompt, "model" | "patterns">) {
  const all = modelSentences(prompt).filter((s) => fitting(s.en));
  const key = (en: string) =>
    prompt.patterns.some((p) =>
      normalizeWords(en)
        .join(" ")
        .includes(normalizeWords(p.example).join(" ")),
    ) ||
    prompt.patterns.some((p) =>
      normalizeWords(p.example)
        .join(" ")
        .includes(normalizeWords(en).join(" ")),
    );
  return unique(
    [...all.filter((s) => key(s.en)), ...all.filter((s) => !key(s.en))].map(
      (s) => ({ ...s, source: "model" as const }),
    ),
  );
}

/** Takes `count` items from `pool`, starting at `offset`, wrapping. */
function rotate<T>(pool: readonly T[], offset: number, count: number): T[] {
  if (pool.length === 0) return [];
  return Array.from(
    { length: Math.min(count, pool.length) },
    (_, i) => pool[(offset + i) % pool.length],
  );
}

/**
 * A day's sentences (days 2–6): up to BACK_FIXES_PER_DAY of the
 * learner's fixes, the rest model (or own) sentences, BACK_PER_DAY in all
 * (fewer when there aren't that many), each day starting further along so
 * the week goes round the whole pool.
 */
export function backTranslationItems({
  prompt,
  day1,
  day,
}: {
  prompt: Pick<WritingPrompt, "model" | "patterns">;
  day1: { essay: string; feedback?: WritingFeedback } | undefined;
  day: 2 | 3 | 4 | 5 | 6;
}): BackItem[] {
  const index = day - 2;
  const fixes = fixedSentences(day1?.essay ?? "", day1?.feedback);
  const reviewed = Boolean(day1?.feedback && !day1.feedback.declined);
  const model = modelPool(prompt);
  const own = unique(
    (day1?.essay ?? "")
      .split(/\n+/)
      .flatMap(splitSentences)
      .map((en) => ({ en: en.trim(), source: "own" as const }))
      .filter((item) => fitting(item.en)),
  );
  // No model essay (a custom prompt): the learner's sentences only.
  const others = model.length > 0 ? model : reviewed ? [] : own;
  const fixCount = Math.min(
    BACK_FIXES_PER_DAY,
    fixes.length,
    others.length > 0 ? BACK_FIXES_PER_DAY : BACK_MAX,
  );
  const fromFixes = rotate(fixes, index * fixCount, fixCount);
  const rest = BACK_PER_DAY - fromFixes.length;
  const fromOthers = rotate(others, index * rest, rest);
  return unique([...fromFixes, ...fromOthers]).slice(0, BACK_MAX);
}

/**
 * How an item is asked in `mode`: without its Chinese, the two
 * meaning-based modes fall back to listening and writing the English.
 */
export function itemMode(item: BackItem, mode: DictationMode): DictationMode {
  return mode !== "listen-write" && !item.zh ? "listen-write" : mode;
}

/** Character pairs of Chinese text, punctuation and spaces aside. */
function bigrams(text: string): string[] {
  const chars = [...text.replace(/[\s\p{P}\p{S}]/gu, "")];
  if (chars.length < 2) return chars;
  return chars.slice(1).map((c, i) => chars[i] + c);
}

/**
 * A Chinese meaning against the reference: the share of the reference's
 * character pairs it has (each counted once). Rough on purpose: the same
 * meaning can be said many ways, so the reference is always shown and
 * MEANING_PASS is low.
 */
export function meaningOverlap(reference: string, answer: string): number {
  const ref = bigrams(reference);
  if (ref.length === 0) return 0;
  const pool = new Map<string, number>();
  for (const b of bigrams(answer)) pool.set(b, (pool.get(b) ?? 0) + 1);
  let hit = 0;
  for (const b of ref) {
    const left = pool.get(b) ?? 0;
    if (left > 0) {
      hit++;
      pool.set(b, left - 1);
    }
  }
  return hit / ref.length;
}

export type BackResult = {
  mode: DictationMode;
  /** 0–1: word accuracy (English), or meaning overlap (Chinese). */
  score: number;
  right: boolean;
};

/** One answer checked: English like ListenLoop's dictation, Chinese by meaning. */
export function checkBack(
  item: BackItem,
  mode: DictationMode,
  answer: string,
): BackResult {
  const asked = itemMode(item, mode);
  if (asked === "listen-zh") {
    const score = meaningOverlap(item.zh ?? "", answer);
    return { mode: asked, score, right: score >= MEANING_PASS };
  }
  const score = scoreDictation(item.en, answer).accuracy;
  return { mode: asked, score, right: score >= BACK_PASS };
}
