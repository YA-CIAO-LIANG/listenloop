import type { LocalDate } from "../dates";
import { normalizeWords } from "../scoring/normalize";
import { scoreDictation } from "../scoring/dictation";
import {
  judgedRight,
  type BackCheckItem,
  type BackJudgement,
} from "./back-check/types";
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

/** A sentence the right length to write back (3–30 words). */
export const fitting = (en: string) => {
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

/** The learner's own Day 1 sentences that fit. */
function ownSentences(essay: string): BackItem[] {
  return unique(
    essay
      .split(/\n+/)
      .flatMap(splitSentences)
      .map((en) => ({ en: en.trim(), source: "own" as const }))
      .filter((item) => fitting(item.en)),
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
  const own = ownSentences(day1?.essay ?? "");
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

/** How sure the learner was before checking (D202). */
export const CONFIDENCE = ["sure", "maybe", "unsure"] as const;
export type Confidence = (typeof CONFIDENCE)[number];

/** One sentence answered: what was written and how it was checked. */
export type BackAnswer = BackResult & {
  answer: string;
  /** Chosen before checking, when asked (D202). */
  confidence?: Confidence;
  /** "Where I think it went wrong", written before the answer (D202). */
  explain?: string;
  /** The learner's date when answered (D203: today's sentences). */
  date?: LocalDate;
  /**
   * Extra practice (D200): waiting for the AI check at the end of the
   * set (the rules didn't find it exactly right).
   */
  pending?: boolean;
  /** The AI's judgement, once checked; `right` then follows it. */
  ai?: BackJudgement;
};

/**
 * Exactly right by the rules (D200): every word (English), or the
 * reference meaning itself (Chinese). Only other answers go to the AI.
 */
export function exactBack(
  item: BackItem,
  result: Pick<BackResult, "mode" | "score">,
  answer: string,
): boolean {
  if (result.mode === "listen-zh") {
    const plain = (t: string) => t.replace(/[\s\p{P}\p{S}]/gu, "");
    return !!item.zh && plain(item.zh) === plain(answer);
  }
  return result.score >= 1;
}

/** The set's answers waiting for the AI, as the check takes them. */
export function pendingChecks(run: BackRun): BackCheckItem[] {
  return run.items.flatMap((item, i) => {
    const a = run.answers[i];
    if (!a?.pending) return [];
    return [
      {
        i,
        mode: a.mode,
        reference: item.en,
        meaning: item.zh ?? "",
        answer: a.answer,
      },
    ];
  });
}

/**
 * The AI's judgements put on a set's answers (D200): each judged answer
 * right or not by them; answers left pending (no judgement came back)
 * keep the rules' result.
 */
export function applyChecks(
  run: BackRun,
  judgements: readonly { i: number; judgement: BackJudgement }[],
): BackRun {
  const byIndex = new Map(judgements.map((j) => [j.i, j.judgement]));
  return {
    ...run,
    answers: run.answers.map((a, i) => {
      if (!a?.pending) return a;
      const ai = byIndex.get(i);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { pending, ...rest } = a;
      return ai ? { ...rest, ai, right: judgedRight(ai) } : rest;
    }),
  };
}

/**
 * A set of sentences as the learner goes through it (D199): the
 * sentences fixed when it starts (so a later AI review doesn't shift
 * them), and one answer slot each, filled in order.
 */
export type BackRun = {
  items: BackItem[];
  answers: (BackAnswer | null)[];
  /** Ended: every sentence answered, or extra practice ended early. */
  done?: boolean;
};

export const newRun = (items: readonly BackItem[]): BackRun => ({
  items: [...items],
  answers: items.map(() => null),
});

/** The first sentence still to answer (items.length when none is left). */
export function nextIndex(run: BackRun): number {
  const i = run.items.findIndex((_, n) => !run.answers[n]);
  return i === -1 ? run.items.length : i;
}

/** The run with sentence `index` answered (a first answer is kept). */
export function answerRun(
  run: BackRun,
  index: number,
  answer: BackAnswer,
): BackRun {
  if (index < 0 || index >= run.items.length || run.answers[index]) return run;
  const answers = run.items.map((_, n) =>
    n === index ? answer : (run.answers[n] ?? null),
  );
  return {
    ...run,
    answers,
    ...(answers.every(Boolean) ? { done: true } : {}),
  };
}

/** The run with the learner's "where it went wrong" on an answer (D202). */
export function explainRun(run: BackRun, index: number, text: string): BackRun {
  const answer = run.answers[index];
  if (!answer || answer.explain !== undefined) return run;
  return {
    ...run,
    answers: run.answers.map((a, i) =>
      i === index && a ? { ...a, explain: text.slice(0, 300) } : a,
    ),
  };
}

/** A run's result: sentences right of those answered, and the mean score. */
export function runSummary(run: BackRun): {
  right: number;
  answered: number;
  total: number;
  percent: number;
} {
  const answered = run.answers.filter((a): a is BackAnswer => !!a);
  return {
    right: answered.filter((a) => a.right).length,
    answered: answered.length,
    total: run.items.length,
    percent: answered.length
      ? Math.round(
          (answered.reduce((sum, a) => sum + a.score, 0) / answered.length) *
            100,
        )
      : 0,
  };
}

const key = (en: string) => normalizeWords(en).join(" ");

/**
 * Extra practice (D199): another set of sentences from the same pool
 * (the learner's fixes, the model's or own sentences), never the ones of
 * the day itself, and not the earlier extra sets of that day until the
 * pool runs out. Empty when the day already used every sentence.
 */
export function extraBackItems({
  prompt,
  day1,
  day,
  round,
  exclude,
  seen = [],
}: {
  prompt: Pick<WritingPrompt, "model" | "patterns">;
  day1: { essay: string; feedback?: WritingFeedback } | undefined;
  day: 2 | 3 | 4 | 5 | 6;
  /** 1 for the first extra set of the day, 2 for the next… */
  round: number;
  /** The day's own sentences. */
  exclude: readonly BackItem[];
  /** Sentences of the earlier extra sets. */
  seen?: readonly BackItem[];
}): BackItem[] {
  const fixes = fixedSentences(day1?.essay ?? "", day1?.feedback);
  const reviewed = Boolean(day1?.feedback && !day1.feedback.declined);
  const model = modelPool(prompt);
  const own = ownSentences(day1?.essay ?? "");
  const pool = unique([
    ...fixes,
    ...(model.length > 0 ? model : reviewed ? [] : own),
  ]);
  const today = new Set(exclude.map((i) => key(i.en)));
  const fresh = pool.filter((i) => !today.has(key(i.en)));
  const earlier = new Set(seen.map((i) => key(i.en)));
  const unseen = fresh.filter((i) => !earlier.has(key(i.en)));
  const from = unseen.length > 0 ? unseen : fresh;
  return rotate(from, (day - 2 + round - 1) * BACK_PER_DAY, BACK_PER_DAY);
}

/**
 * The sentences written back wrong, for the notebook (D199): written
 * again from the Chinese (or from the sound, without it) 1, 3, and 7
 * days later.
 */
export function backNotebookItems(promptId: string, run: BackRun) {
  return run.items.flatMap((item, i) => {
    const answer = run.answers[i];
    // Wrong; or right but unsure, which is forgotten without another
    // look (D202, learning-science.md §10).
    if (!answer || (answer.right && answer.confidence !== "unsure")) {
      return [];
    }
    return [
      {
        id: `b:${promptId}:${textKey(item.en)}`,
        kind: "back" as const,
        promptId,
        text: item.zh ?? "",
        answer: item.en,
        note: answer.answer,
        // Sure but wrong: reviewed first (hypercorrection, D202).
        ...(!answer.right && answer.confidence === "sure"
          ? { priority: true }
          : {}),
      },
    ];
  });
}

/**
 * How often a sentence was answered before in this prompt's week (D202):
 * in each day's set and extra practice, except `current` (the set being
 * done now).
 */
export function timesSeen(
  days: Record<number, unknown>,
  en: string,
  current?: BackRun,
): number {
  const k = key(en);
  let seen = 0;
  for (const value of Object.values(days)) {
    const day = value as { back?: BackRun; extra?: BackRun } | undefined;
    for (const run of [day?.back, day?.extra]) {
      if (!run || run === current) continue;
      run.items.forEach((item, i) => {
        if (run.answers[i] && key(item.en) === k) seen += 1;
      });
    }
  }
  return seen;
}

/**
 * Hints fade (D202): the first try shows the word count and each word's
 * first letter, the second only the count, later none.
 */
export const hintLevel = (seen: number): 0 | 1 | 2 =>
  seen <= 0 ? 2 : seen === 1 ? 1 : 0;

/** The hint for a sentence at a level: its words, first letters shown. */
export function sentenceHint(
  en: string,
  level: 0 | 1 | 2,
): { words: number; letters: string } | null {
  if (level === 0) return null;
  const words = en.split(/\s+/).filter(Boolean);
  return {
    words: words.length,
    letters:
      level === 2
        ? words
            .map((w) => {
              const letter = /[a-z0-9]/i.exec(w)?.[0] ?? "";
              return `${letter}${"_".repeat(Math.min(3, Math.max(1, w.replace(/[^a-z0-9']/gi, "").length - 1)))}`;
            })
            .join(" ")
        : "",
  };
}

/** A short, stable id for a sentence. */
function textKey(text: string): string {
  let h = 5381;
  for (const ch of key(text)) h = ((h << 5) + h + ch.charCodeAt(0)) | 0;
  return (h >>> 0).toString(36);
}
