import { isRichNotes, type RichNotes } from "./custom-practice/rich-notes";

/**
 * Suggested fixes to published official materials (D117), made by rules
 * (no AI) or written by hand from the quality audit, and the checks that
 * keep the same problems out of new materials: full-width letters and
 * digits in Chinese, names written two ways, and notes too long to read
 * after one sentence. Fixes wait for an admin; nothing here writes.
 */

export const FIX_FIELDS = ["zh", "notes"] as const;
export type FixField = (typeof FIX_FIELDS)[number];

export const FIX_KINDS = [
  "full-width",
  "name",
  "translation",
  "long-notes",
] as const;
export type FixKind = (typeof FIX_KINDS)[number];

export const FIX_STATUSES = [
  "pending",
  "accepted",
  "rejected",
  "stale",
] as const;
export type FixStatus = (typeof FIX_STATUSES)[number];

/** Full-width Latin letters and digits (Ａ–Ｚ, ａ–ｚ, ０–９). */
const FULL_WIDTH = /[０-９Ａ-Ｚａ-ｚ]/g;

export const hasFullWidth = (text: string) => new RegExp(FULL_WIDTH).test(text);

/**
 * Full-width letters and digits as ordinary ones ("４號月台" → "4號月台").
 * Chinese punctuation stays full-width: that's how Taiwan writes it.
 */
export function halfWidth(text: string): string {
  return text.replace(FULL_WIDTH, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );
}

/** Characters of text in stored notes (every string, no field names). */
export function textLength(value: unknown): number {
  if (typeof value === "string") return [...value].length;
  if (Array.isArray(value)) return value.reduce((n, v) => n + textLength(v), 0);
  if (typeof value === "object" && value !== null) {
    return Object.values(value).reduce((n: number, v) => n + textLength(v), 0);
  }
  return 0;
}

/** Every string in `value` with half-width digits and letters (D117). */
export function halfWidthDeep<T>(value: T): T {
  if (typeof value === "string") return halfWidth(value) as T;
  if (Array.isArray(value)) return value.map(halfWidthDeep) as T;
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, halfWidthDeep(v)]),
    ) as T;
  }
  return value;
}

/**
 * Notes with this many characters or fewer are short enough (D117): a
 * little under the audit's LONG_NOTES_CHARS, so a shortened sentence
 * isn't flagged again by the next audit.
 */
export const NOTES_TARGET_CHARS = 1_000;

/**
 * The ways to shorten notes, mildest first. Each keeps what's most worth
 * reading: the highlights, the chunks of a hard sentence, the first
 * example, the words that appear in the sentence.
 */
export const SHORTEN_STEPS = [
  "oneExample",
  "twoCollocations",
  "twoConnected",
  "noPitfalls",
  "twoVocab",
  "oneGrammar",
  "noCollocations",
  "oneConnected",
] as const;
export type ShortenStep = (typeof SHORTEN_STEPS)[number];

function applyStep(notes: RichNotes, step: ShortenStep): RichNotes {
  switch (step) {
    case "oneExample":
      return {
        ...notes,
        vocab: notes.vocab.map((v) => ({
          ...v,
          examples: v.examples.slice(0, 1),
        })),
        grammar: notes.grammar.map((g) => ({
          ...g,
          examples: g.examples.slice(0, 1),
        })),
      };
    case "twoCollocations":
    case "noCollocations": {
      const keep = step === "noCollocations" ? 0 : 2;
      return {
        ...notes,
        vocab: notes.vocab.map((v) => ({
          ...v,
          collocations: v.collocations.slice(0, keep),
        })),
      };
    }
    case "twoConnected":
    case "oneConnected":
      return {
        ...notes,
        connected: notes.connected.slice(0, step === "oneConnected" ? 1 : 2),
      };
    case "noPitfalls":
      return {
        ...notes,
        grammar: notes.grammar.map((g) => ({ ...g, pitfall: "" })),
      };
    case "twoVocab": {
      // Words heard in the sentence first: they're what a learner missed.
      const ranked = [...notes.vocab].sort(
        (a, b) => Number(!a.inSentence) - Number(!b.inSentence),
      );
      const kept = new Set(ranked.slice(0, 2));
      return { ...notes, vocab: notes.vocab.filter((v) => kept.has(v)) };
    }
    case "oneGrammar":
      return { ...notes, grammar: notes.grammar.slice(0, 1) };
  }
}

/**
 * Notes cut down step by step until they fit `target` characters (as the
 * audit counts them), with the steps that changed something. Notes that
 * already fit come back unchanged with no steps; notes that still don't
 * fit after every step come back as short as the steps make them.
 */
export function shortenNotes(
  notes: RichNotes,
  target = NOTES_TARGET_CHARS,
): { notes: RichNotes; steps: ShortenStep[] } {
  let current = notes;
  const steps: ShortenStep[] = [];
  for (const step of SHORTEN_STEPS) {
    if (textLength(current) <= target) break;
    const next = applyStep(current, step);
    if (textLength(next) < textLength(current)) {
      current = next;
      steps.push(step);
    }
  }
  return { notes: current, steps };
}

/** A capitalized word that may be a name: "Mira", "Hillview". */
const NAME = /\b[A-Z][a-z]{1,}\b/g;

/** Capitalized words that aren't names (sentence starts, days, months…). */
const NOT_NAMES = new Set(
  (
    "I The This That These Those It And But So We You Yes No Oh Well Please Then " +
    "Thanks Thank Sure Okay Great Good Hi Hello Can Could What How When Where Why Who " +
    "If Of Let My Our Your His Her Their Actually Also Right Perfect Next First Finally " +
    "Sorry Excuse Maybe Do Does Did Is Are Was Were Would Will Wow There Just Now Today " +
    "In On At For As To From With By After Before Or Which Instead Mum Mom Dad " +
    "Monday Tuesday Wednesday Thursday Friday Saturday Sunday Mondays Tuesdays " +
    "Wednesdays Thursdays Fridays Saturdays Sundays January February March April May " +
    "June July August September October November December English Chinese"
  ).split(" "),
);

/**
 * Names a material writes two ways in Chinese (D117): a name kept in
 * English in one sentence's translation and translated in another
 * ("Alex" here, 「亞歷克斯」 there). Only names that appear in English in
 * at least one translation count, so a place every sentence translates
 * the same way (「湖濱大學」) isn't flagged. Returns each such name with
 * the sentences whose translation leaves it out.
 */
export function inconsistentNames(
  sentences: readonly { en: string; zh: string | null }[],
): { name: string; sentences: number[] }[] {
  const seen = new Map<string, { kept: number; missing: number[] }>();
  sentences.forEach((s, i) => {
    // The first word of a sentence is capitalized anyway.
    const words = new Set(
      [...s.en.matchAll(NAME)]
        .filter((m) => m.index !== s.en.search(/[A-Za-z]/))
        .map((m) => m[0])
        .filter((w) => !NOT_NAMES.has(w)),
    );
    for (const name of words) {
      const entry = seen.get(name) ?? { kept: 0, missing: [] };
      if ((s.zh ?? "").includes(name)) entry.kept += 1;
      else entry.missing.push(i);
      seen.set(name, entry);
    }
  });
  return [...seen]
    .filter(([, e]) => e.kept > 0 && e.missing.length > 0)
    .map(([name, e]) => ({ name, sentences: e.missing }));
}

/** A fix as the generator makes it, before it's stored. */
export type FixDraft = {
  practiceId: string;
  sentenceIndex: number;
  field: FixField;
  kind: FixKind;
  current: unknown;
  suggested: unknown;
  reason: string | null;
  detail: Record<string, unknown>;
};

/** A hand-written fix from the audit's review (scripts/content-fixes/). */
export type HandFix = {
  practiceId: string;
  /** 0-based. */
  sentence: number;
  kind: Extract<FixKind, "name" | "translation">;
  zh: string;
  reason: string;
};

export type FixSentence = {
  i: number;
  en: string;
  zh: string | null;
  notes: unknown;
};

/**
 * Every fix for one material (D117): the hand-written ones, full-width
 * letters and digits in any other translation, and notes over
 * `longerThan` characters shortened. A hand-written fix wins over a
 * full-width one for the same sentence (it's written in half-width).
 */
export function fixesFor(
  practiceId: string,
  sentences: readonly FixSentence[],
  hand: readonly HandFix[],
  longerThan: number,
): FixDraft[] {
  const drafts: FixDraft[] = [];
  const handBySentence = new Map(
    hand.filter((h) => h.practiceId === practiceId).map((h) => [h.sentence, h]),
  );
  for (const s of sentences) {
    const zh = s.zh ?? "";
    const own = handBySentence.get(s.i);
    if (own) {
      if (own.zh !== zh) {
        drafts.push({
          practiceId,
          sentenceIndex: s.i,
          field: "zh",
          kind: own.kind,
          current: zh,
          suggested: halfWidth(own.zh),
          reason: own.reason,
          detail: {},
        });
      }
    } else if (hasFullWidth(zh)) {
      drafts.push({
        practiceId,
        sentenceIndex: s.i,
        field: "zh",
        kind: "full-width",
        current: zh,
        suggested: halfWidth(zh),
        reason: null,
        detail: {},
      });
    }
    if (isRichNotes(s.notes) && textLength(s.notes) > longerThan) {
      const { notes, steps } = shortenNotes(s.notes);
      if (steps.length > 0) {
        drafts.push({
          practiceId,
          sentenceIndex: s.i,
          field: "notes",
          kind: "long-notes",
          current: s.notes,
          suggested: notes,
          reason: null,
          detail: {
            steps,
            before: textLength(s.notes),
            after: textLength(notes),
          },
        });
      }
    }
  }
  return drafts;
}

/** Whether a stored value is still what the fix was made from. */
export function unchangedSince(stored: unknown, current: unknown): boolean {
  return JSON.stringify(stored ?? null) === JSON.stringify(current ?? null);
}
