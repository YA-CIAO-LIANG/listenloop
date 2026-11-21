import {
  clampScore,
  percentScore,
  RUBRICS,
  type CriterionScore,
} from "./rubrics";
import { isErrorType, type ErrorType, type RubricId } from "./types";

/**
 * AI feedback on an essay (D187), as stored and shown. The model's answer
 * is never trusted as is: `cleanFeedback` keeps only what the rules allow
 * (learning-science.md, cognitive load and academic integrity):
 * - at most 3 main issues, shown on the essay; smaller ones under "more";
 * - 1–2 strengths;
 * - a suggestion rewrites at most 3 sentences, never the whole essay;
 * - a quote must really be in the essay (or it isn't highlighted);
 * - scores within each criterion's range, each with its reason.
 */
export type FeedbackIssue = {
  /** The learner's own words, exactly as written (English). */
  quote: string;
  type: ErrorType;
  /** Why it's a problem, in Chinese. */
  why: string;
  /** A corrected version of the quoted part (at most 3 sentences). */
  suggestion: string;
  /**
   * The corrected sentence's meaning in Chinese, for writing it again
   * from its meaning (D195). Not asked of the model yet: adding it to
   * the prompt lowered the writing eval (D195), so it waits for Joe.
   */
  zh?: string;
};

export type FeedbackStrength = { quote: string; why: string };

export type WritingFeedback = {
  rubric: RubricId;
  criteria: (CriterionScore & { reason: string })[];
  /** 0–100 (lib/writing/rubrics.ts). */
  percent: number;
  issues: FeedbackIssue[];
  more: FeedbackIssue[];
  strengths: FeedbackStrength[];
  /** Two or three sentences in Chinese. */
  summary: string;
  /**
   * The essay asked for it to be written for the learner, or wasn't an
   * attempt at the task: no score, a pointer back to practice.
   */
  declined?: "ghostwrite" | "off-task" | "too-short";
};

export const MAX_ISSUES = 3;
export const MAX_MORE = 8;
export const MAX_STRENGTHS = 2;
export const MAX_SUGGESTION_SENTENCES = 3;
const MAX_TEXT = 600;

const text = (value: unknown, max = MAX_TEXT) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

/** Sentences in an English suggestion, by end punctuation. */
export function sentenceCount(value: string): number {
  return value
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => /[A-Za-z]/.test(s)).length;
}

/** Keeps the first `max` sentences. */
function firstSentences(value: string, max: number): string {
  return value
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim())
    .slice(0, max)
    .join(" ");
}

const squash = (value: string) =>
  value
    .toLowerCase()
    .replace(/[\s’']+/g, " ")
    .trim();

/** Whether `quote` appears in the essay (spacing, case, and quotes aside). */
export function quoteInEssay(quote: string, essay: string): boolean {
  const q = squash(quote);
  return q.length > 0 && squash(essay).includes(q);
}

function cleanIssue(raw: unknown, essay: string): FeedbackIssue | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const quote = text(r.quote, 300);
  const why = text(r.why);
  let suggestion = text(r.suggestion, 500);
  if (!why) return null;
  if (sentenceCount(suggestion) > MAX_SUGGESTION_SENTENCES) {
    suggestion = firstSentences(suggestion, MAX_SUGGESTION_SENTENCES);
  }
  // A "suggestion" as long as the essay is a rewrite, not a hint.
  if (essay.length > 200 && suggestion.length > essay.length * 0.6) {
    suggestion = firstSentences(suggestion, 1);
  }
  return {
    quote: quoteInEssay(quote, essay) ? quote : "",
    type: isErrorType(r.type) ? r.type : "grammar",
    why,
    suggestion,
  };
}

/**
 * The model's answer, made safe to store and show. Null when it isn't
 * usable at all (no scores and not declined).
 */
export function cleanFeedback(
  raw: unknown,
  essay: string,
  rubricId: RubricId,
): WritingFeedback | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const rubric = RUBRICS[rubricId];
  const declined =
    r.declined === "ghostwrite" ||
    r.declined === "off-task" ||
    r.declined === "too-short"
      ? r.declined
      : undefined;
  const rawCriteria = Array.isArray(r.criteria) ? r.criteria : [];
  const criteria = rubric.criteria.map((criterion) => {
    const found = rawCriteria.find(
      (c): c is Record<string, unknown> =>
        !!c &&
        typeof c === "object" &&
        (c as { id?: unknown }).id === criterion.id,
    );
    return {
      id: criterion.id,
      score: declined ? 0 : clampScore(criterion, Number(found?.score)),
      reason: text(found?.reason),
    };
  });
  if (!declined && criteria.some((c) => !c.reason)) return null;
  const issues = (Array.isArray(r.issues) ? r.issues : [])
    .map((i) => cleanIssue(i, essay))
    .filter((i): i is FeedbackIssue => i !== null);
  const more = (Array.isArray(r.more) ? r.more : [])
    .map((i) => cleanIssue(i, essay))
    .filter((i): i is FeedbackIssue => i !== null);
  const strengths = (Array.isArray(r.strengths) ? r.strengths : [])
    .map((s) => {
      if (!s || typeof s !== "object") return null;
      const o = s as Record<string, unknown>;
      const why = text(o.why);
      if (!why) return null;
      const quote = text(o.quote, 300);
      return { quote: quoteInEssay(quote, essay) ? quote : "", why };
    })
    .filter((s): s is FeedbackStrength => s !== null)
    .slice(0, MAX_STRENGTHS);
  return {
    rubric: rubricId,
    criteria,
    percent: declined ? 0 : percentScore(rubric, criteria),
    // Anything past the first 3 moves to "more" (cognitive load, D187).
    issues: issues.slice(0, MAX_ISSUES),
    more: [...issues.slice(MAX_ISSUES), ...more].slice(0, MAX_MORE),
    strengths,
    summary: text(r.summary),
    ...(declined ? { declined } : {}),
  };
}

/** Error types of the main issues, most important first, no repeats. */
export function weaknesses(feedback: WritingFeedback | null): ErrorType[] {
  if (!feedback) return [];
  const seen: ErrorType[] = [];
  for (const issue of [...feedback.issues, ...feedback.more]) {
    if (!seen.includes(issue.type)) seen.push(issue.type);
  }
  return seen;
}
