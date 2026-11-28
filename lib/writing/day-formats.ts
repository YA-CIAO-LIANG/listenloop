import { normalizeWords } from "../scoring/normalize";
import {
  BACK_MAX,
  fitting,
  modelSentences,
  type BackItem,
  type BackRun,
  type Day1Source,
} from "./back-translation";
import { chosenVersion } from "./rewrite/state";
import type { WritingPrompt } from "./types";

/**
 * Days 2–6, one way of remembering each (D219, learning-science.md §17):
 * from recognizing the corrected sentences to writing whole paragraphs
 * from memory, each day a little harder (desirable difficulties), the
 * hints fading day by day. Each day's way can be changed in the writing
 * settings; the sentences answered wrong the day before come first.
 */
export const DAY_FORMATS = [
  "listen-read",
  "cloze",
  "hints",
  "zh-en",
  "paragraph",
  // The back-translation of D195, in the mode chosen in the settings:
  // still there for anyone who likes it.
  "dictation",
] as const;
export type DayFormat = (typeof DAY_FORMATS)[number];

export const FORMAT_DAYS = [2, 3, 4, 5, 6] as const;
export type FormatDay = (typeof FORMAT_DAYS)[number];

/** Joe's order (D219): listen and read, cloze, hints, Chinese → English, paragraph. */
export const DEFAULT_DAY_FORMATS: Readonly<Record<FormatDay, DayFormat>> = {
  2: "listen-read",
  3: "cloze",
  4: "hints",
  5: "zh-en",
  6: "paragraph",
};

export const isDayFormat = (v: unknown): v is DayFormat =>
  (DAY_FORMATS as readonly unknown[]).includes(v);

export function parseDayFormats(value: unknown): Record<FormatDay, DayFormat> {
  const v = (value && typeof value === "object" ? value : {}) as Record<
    string,
    unknown
  >;
  return Object.fromEntries(
    FORMAT_DAYS.map((d) => [
      d,
      isDayFormat(v[d]) ? v[d] : DEFAULT_DAY_FORMATS[d],
    ]),
  ) as Record<FormatDay, DayFormat>;
}

/** Sentences a day takes in the sentence formats; paragraphs a day. */
export const FORMAT_SENTENCES = BACK_MAX;
export const PARAGRAPHS_PER_DAY = 3;
/** A paragraph longer than this is written back in pieces. */
export const PARAGRAPH_SENTENCES = 4;

const key = (en: string) => normalizeWords(en).join(" ");

/**
 * The sentences answered wrong on the day before (D219: they come first
 * the next day), by their text.
 */
export function wrongBefore(
  days: Record<number, unknown>,
  day: FormatDay,
): Set<string> {
  const wrong = new Set<string>();
  for (let d = day - 1; d >= 2; d--) {
    const back = (days[d] as { back?: BackRun } | undefined)?.back;
    if (!back) continue;
    back.items.forEach((item, i) => {
      const a = back.answers[i];
      if (a && !a.right && !a.viewed) wrong.add(key(item.en));
      // A paragraph wrong: its sentences come first.
      if (a && !a.right && item.parts) {
        for (const part of item.parts) wrong.add(key(part));
      }
    });
    break;
  }
  return wrong;
}

/** Takes `count` from `pool` starting at `offset`, wrapping, no repeats. */
function rotate<T>(pool: readonly T[], offset: number, count: number): T[] {
  if (pool.length === 0) return [];
  return Array.from(
    { length: Math.min(count, pool.length) },
    (_, i) => pool[(offset + i) % pool.length],
  );
}

/** The learner's chosen version (or the model essay) as sentences. */
function sentencePool(
  prompt: Pick<WritingPrompt, "model">,
  day1: Day1Source | undefined,
): (BackItem & { p: number })[] {
  const version = chosenVersion(day1);
  if (version) {
    return version.sentences.map((s) => ({
      en: s.revised,
      ...(s.zh ? { zh: s.zh } : {}),
      ...(s.changed ? { original: s.original } : {}),
      source: s.changed ? ("fix" as const) : ("own" as const),
      p: s.p,
    }));
  }
  let p = 0;
  return prompt.model.en.flatMap((paragraph, index) => {
    const sentences = modelSentences({
      model: { en: [paragraph], zh: [prompt.model.zh[index] ?? ""] },
    });
    p = index;
    return sentences.map((s) => ({ ...s, source: "model" as const, p }));
  });
}

/**
 * A day's items in its format (D219). Sentence formats: up to
 * FORMAT_SENTENCES, yesterday's wrong ones first, then the changed
 * sentences, then the rest, each day further along the essay.
 * "paragraph": the essay's paragraphs (cut into pieces of at most
 * PARAGRAPH_SENTENCES sentences), up to PARAGRAPHS_PER_DAY.
 */
export function formatItems({
  prompt,
  day1,
  day,
  format,
  days,
}: {
  prompt: Pick<WritingPrompt, "model">;
  day1: Day1Source | undefined;
  day: FormatDay;
  format: DayFormat;
  days: Record<number, unknown>;
}): BackItem[] {
  const pool = sentencePool(prompt, day1);
  const wrong = wrongBefore(days, day);
  if (format === "paragraph") {
    const pieces: BackItem[] = [];
    const byParagraph = new Map<number, typeof pool>();
    for (const s of pool) {
      byParagraph.set(s.p, [...(byParagraph.get(s.p) ?? []), s]);
    }
    for (const sentences of byParagraph.values()) {
      for (let i = 0; i < sentences.length; i += PARAGRAPH_SENTENCES) {
        const part = sentences.slice(i, i + PARAGRAPH_SENTENCES);
        const zh = part.every((s) => s.zh)
          ? part.map((s) => s.zh).join("")
          : undefined;
        pieces.push({
          en: part.map((s) => s.en).join(" "),
          ...(zh ? { zh } : {}),
          source: part[0].source,
          parts: part.map((s) => s.en),
        });
      }
    }
    const first = pieces.filter((piece) =>
      piece.parts?.some((s) => wrong.has(key(s))),
    );
    const rest = pieces.filter((piece) => !first.includes(piece));
    return [...first, ...rest].slice(0, PARAGRAPHS_PER_DAY);
  }
  const usable = pool
    .filter((s) => fitting(s.en))
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .map(({ p, ...item }) => item);
  const seen = new Set<string>();
  const unique = usable.filter((s) => {
    const k = key(s.en);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const first = unique.filter((s) => wrong.has(key(s.en)));
  const ordered = [
    ...unique.filter((s) => s.source === "fix"),
    ...unique.filter((s) => s.source !== "fix"),
  ].filter((s) => !first.includes(s));
  // Each day further along: everything is seen over the week.
  const room = Math.max(0, FORMAT_SENTENCES - first.length);
  const rest =
    ordered.length <= room ? ordered : rotate(ordered, (day - 2) * room, room);
  return [...first, ...rest].slice(0, FORMAT_SENTENCES);
}

/** Small words never blanked in a cloze. */
const STOP = new Set(
  "a an the and or but so of to in on at for with by from up as is am are was were be been it its this that these those i you he she we they me him her us them my your his our their do does did not no".split(
    " ",
  ),
);

const bare = (w: string) => w.toLowerCase().replace(/[^a-z0-9'-]/g, "");

/**
 * A cloze's blanks (D219): the word positions in `en` (split on spaces)
 * to hide, 1 to 3 by length: the words the AI changed first (what the
 * learner most needs), then the longest content words. Deterministic.
 */
export function clozeBlanks(item: Pick<BackItem, "en" | "original">): number[] {
  const words = item.en.split(/\s+/).filter(Boolean);
  const count = words.length < 8 ? 1 : words.length < 15 ? 2 : 3;
  const before = new Set(
    (item.original ?? "").split(/\s+/).map(bare).filter(Boolean),
  );
  const candidates = words
    .map((w, i) => ({ i, w: bare(w) }))
    .filter(({ w }) => w.length >= 2 && !STOP.has(w) && /[a-z]/.test(w));
  const changed = item.original
    ? candidates.filter(({ w }) => !before.has(w))
    : [];
  const rest = candidates
    .filter((c) => !changed.includes(c))
    .sort((a, b) => b.w.length - a.w.length || a.i - b.i);
  return [...changed, ...rest]
    .slice(0, count)
    .map((c) => c.i)
    .sort((a, b) => a - b);
}

/** The cloze's answers checked, blank by blank (case and punctuation aside). */
export function checkCloze(
  en: string,
  blanks: readonly number[],
  answers: readonly string[],
): { right: boolean[]; score: number } {
  const words = en.split(/\s+/).filter(Boolean);
  const right = blanks.map(
    (b, k) =>
      normalizeWords(words[b] ?? "").join(" ") ===
      normalizeWords(answers[k] ?? "").join(" "),
  );
  return {
    right,
    score: blanks.length ? right.filter(Boolean).length / blanks.length : 0,
  };
}
