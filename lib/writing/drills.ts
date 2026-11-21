import { scoreDictation } from "@/lib/scoring/dictation";
import { normalizeWords } from "@/lib/scoring/normalize";
import type { WritingFeedback } from "./feedback";
import { sentenceCount } from "./feedback";
import type { ExerciseKind } from "./progress";
import type { ErrorType, WritingPrompt } from "./types";

/**
 * Days 2–6 (D187): one or two drills a day, chosen from the learner's own
 * Day 1 weaknesses (deliberate practice), mixed so the same kind doesn't
 * come two days running (interleaving). Each drill is checked at once,
 * by rules (no paid API) and with the model answers to compare against.
 */

/** Which drills work on which kind of mistake. */
const DRILLS_FOR: Readonly<Record<ErrorType, readonly ExerciseKind[]>> = {
  grammar: ["fix", "pattern"],
  verb: ["fix", "pattern"],
  article: ["fix", "rebuild"],
  preposition: ["fix", "rebuild"],
  "word-choice": ["paraphrase", "fix"],
  spelling: ["fix", "rebuild"],
  punctuation: ["fix", "combine"],
  sentence: ["combine", "fix"],
  cohesion: ["reorder", "combine"],
  organization: ["reorder", "rebuild"],
  task: ["rebuild", "listen"],
  tone: ["paraphrase", "pattern"],
};

/** Everything, for a learner with no known weakness yet. */
const DEFAULT_ORDER: readonly ExerciseKind[] = [
  "fix",
  "pattern",
  "combine",
  "reorder",
  "paraphrase",
  "rebuild",
  "listen",
];

export const DRILL_DAYS = [2, 3, 4, 5, 6] as const;
export type DrillDayNumber = (typeof DRILL_DAYS)[number];
export const DRILLS_PER_DAY = 2;

/**
 * The drills of days 2–6: the weaknesses' drills first, then the rest
 * once each, then the top weaknesses again; never the same kind on two
 * days in a row. `canFix`: the learner has their own sentences to fix
 * (AI feedback quoted them); otherwise no "fix".
 */
export function planDrills(
  weak: readonly ErrorType[],
  canFix: boolean,
): Record<DrillDayNumber, ExerciseKind[]> {
  const allowed = (kind: ExerciseKind) => canFix || kind !== "fix";
  const fromWeak: ExerciseKind[] = [];
  for (const type of weak) {
    for (const kind of DRILLS_FOR[type]) {
      if (allowed(kind) && !fromWeak.includes(kind)) fromWeak.push(kind);
    }
  }
  const rest = DEFAULT_ORDER.filter(
    (kind) => allowed(kind) && !fromWeak.includes(kind),
  );
  const queue = [...fromWeak, ...rest];
  const top = fromWeak.length ? fromWeak.slice(0, 3) : queue.slice(0, 3);
  let i = 0;
  while (queue.length < DRILL_DAYS.length * DRILLS_PER_DAY) {
    queue.push(top[i % top.length]);
    i++;
  }
  const plan = {} as Record<DrillDayNumber, ExerciseKind[]>;
  let previous: ExerciseKind[] = [];
  for (const day of DRILL_DAYS) {
    const today: ExerciseKind[] = [];
    while (today.length < DRILLS_PER_DAY && queue.length) {
      const fresh = (kind: ExerciseKind) =>
        !previous.includes(kind) && !today.includes(kind);
      const index = queue.findIndex(fresh);
      if (index !== -1) {
        today.push(queue.splice(index, 1)[0]);
        continue;
      }
      // Only yesterday's kinds are left in the queue: another kind instead.
      const other = DEFAULT_ORDER.find((kind) => allowed(kind) && fresh(kind));
      queue.shift();
      if (other) today.push(other);
    }
    plan[day] = today;
    previous = today;
  }
  return plan;
}

/** The sentences to fix: the AI's quoted issues, main ones first (≤ 3). */
export function fixItems(feedback: WritingFeedback | undefined) {
  if (!feedback) return [];
  return [...feedback.issues, ...feedback.more]
    .filter((issue) => issue.quote && issue.suggestion)
    .slice(0, 3);
}

/** Sentences of a paragraph, by end punctuation. */
export function splitSentences(paragraph: string): string[] {
  return paragraph
    .split(/(?<=[.!?])\s+(?=[A-Z"'(])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** A small deterministic generator, so a day's shuffle stays put. */
function seeded(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/** The model paragraph with the most sentences (≥ 3) for reordering. */
export function reorderParagraph(prompt: WritingPrompt): string[] {
  const best = prompt.model.en
    .map(splitSentences)
    .sort((a, b) => b.length - a.length)[0];
  return best && best.length >= 3 ? best.slice(0, 6) : [];
}

/** Indexes in a shuffled order that is never the original. */
export function shuffledOrder(count: number, seed: string): number[] {
  const order = Array.from({ length: count }, (_, i) => i);
  if (count < 2) return order;
  const random = seeded(seed);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  if (order.every((value, index) => value === index)) order.reverse();
  return order;
}

/** The shortest model paragraph of two sentences or more, to rebuild. */
export function rebuildParagraph(prompt: WritingPrompt): string {
  const candidates = prompt.model.en.filter(
    (p) => splitSentences(p).length >= 2,
  );
  const pool = candidates.length ? candidates : prompt.model.en;
  return [...pool].sort((a, b) => a.length - b.length)[0] ?? "";
}

/** How long the paragraph to rebuild stays on screen. */
export const REBUILD_SHOW_SECONDS = 30;

/** Rebuilt from memory: words right, as in dictation (0–1). */
export function rebuildAccuracy(original: string, answer: string): number {
  return scoreDictation(original, answer).accuracy;
}

/** A rebuild counts as right from this share of words. */
export const REBUILD_PASS = 0.6;

const words = (text: string) => normalizeWords(text);

/** Share of `b`'s distinct words found in `a`. */
function overlap(a: string, b: string): number {
  const mine = new Set(words(a));
  const theirs = new Set(words(b));
  if (theirs.size === 0) return 0;
  let hit = 0;
  for (const w of theirs) if (mine.has(w)) hit++;
  return hit / theirs.size;
}

const STOP = new Set(
  "a an the and or but so to of in on at for with is are was were be it this that i you he she we they my your".split(
    " ",
  ),
);
const contentWords = (text: string) =>
  [...new Set(words(text))].filter((w) => !STOP.has(w));

export type DrillCheck = { ok: boolean; reason?: DrillProblem };
export type DrillProblem =
  | "empty"
  | "short"
  | "copied"
  | "missingPattern"
  | "notOneSentence"
  | "lostMeaning"
  | "same"
  | "differs";

/** Imitation: uses the pattern's words, in a sentence of its own. */
export function checkPattern(
  answer: string,
  pattern: { keys: string[]; example: string },
): DrillCheck {
  const typed = words(answer);
  if (typed.length === 0) return { ok: false, reason: "empty" };
  if (typed.length < 6) return { ok: false, reason: "short" };
  if (
    overlap(answer, pattern.example) > 0.8 &&
    overlap(pattern.example, answer) > 0.8
  )
    return { ok: false, reason: "copied" };
  const lower = ` ${typed.join(" ")} `;
  const missing = pattern.keys.some(
    (key) => !lower.includes(` ${words(key).join(" ")} `),
  );
  return missing ? { ok: false, reason: "missingPattern" } : { ok: true };
}

/** Combining: one sentence that keeps most of the parts' content. */
export function checkCombine(
  answer: string,
  drill: { parts: string[] },
): DrillCheck {
  if (!answer.trim()) return { ok: false, reason: "empty" };
  if (sentenceCount(answer) !== 1)
    return { ok: false, reason: "notOneSentence" };
  const needed = contentWords(drill.parts.join(" "));
  const have = new Set(words(answer));
  const kept = needed.filter((w) => have.has(w)).length;
  return needed.length && kept / needed.length < 0.7
    ? { ok: false, reason: "lostMeaning" }
    : { ok: true };
}

/** Paraphrasing: different wording, the same main content words. */
export function checkParaphrase(
  answer: string,
  drill: { sentence: string },
): DrillCheck {
  const typed = words(answer);
  if (typed.length === 0) return { ok: false, reason: "empty" };
  if (typed.length < 4) return { ok: false, reason: "short" };
  const same =
    overlap(answer, drill.sentence) > 0.85 &&
    overlap(drill.sentence, answer) > 0.85;
  if (same) return { ok: false, reason: "same" };
  const needed = contentWords(drill.sentence);
  const have = new Set(typed);
  const kept = needed.filter((w) => have.has(w)).length;
  // Synonyms are the point, so only one key word has to stay.
  return needed.length >= 3 && kept === 0
    ? { ok: false, reason: "lostMeaning" }
    : { ok: true };
}

/** Fixing one's own sentence: changed, and close to the suggestion. */
export function checkFix(
  answer: string,
  issue: { quote: string; suggestion: string },
): DrillCheck {
  if (!answer.trim()) return { ok: false, reason: "empty" };
  const unchanged = words(answer).join(" ") === words(issue.quote).join(" ");
  if (unchanged) return { ok: false, reason: "same" };
  return scoreDictation(issue.suggestion, answer).accuracy >= 0.8
    ? { ok: true }
    : { ok: false, reason: "differs" };
}
