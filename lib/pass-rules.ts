/**
 * What finishes each day and passes the week (D92). Each practice can set
 * its own in its settings; without settings, DEFAULT_PASS_RULES apply. The
 * numbers and the choices offered live here only.
 */
export type Day7Rule =
  /** Day 7's accuracy beats Day 1's (a perfect Day 1 needs a perfect Day 7). */
  | { kind: "improve" }
  /** Day 7's accuracy reaches `min` (the original 80% rule). */
  | { kind: "score"; min: number };

export type PassRules = {
  /**
   * Days 1 and 7: the lowest (speed-weighted) accuracy that finishes the
   * day. 0 = answering every sentence is enough.
   */
  dictationMin: number;
  /** Days 2–6: the share of a sentence's words that counts as read aloud. */
  shadowingMin: number;
  day7: Day7Rule;
};

export const DEFAULT_PASS_RULES: PassRules = {
  dictationMin: 0,
  shadowingMin: 0.6,
  day7: { kind: "improve" },
};

/** The choices in the practice settings. */
export const DICTATION_MIN_OPTIONS = [0, 0.5, 0.6, 0.7, 0.8, 0.9] as const;
export const SHADOWING_MIN_OPTIONS = [0.5, 0.6, 0.7, 0.8, 0.9] as const;
export const DAY7_SCORE_OPTIONS = [0.6, 0.7, 0.8, 0.9, 1] as const;

// Scores are sums of fractions: 0.8 can arrive as 0.7999999999999999.
const EPSILON = 1e-9;

const isRatio = (value: unknown): value is number =>
  typeof value === "number" && value >= 0 && value <= 1;

export function isPassRules(value: unknown): value is PassRules {
  if (typeof value !== "object" || value === null) return false;
  const rules = value as Record<string, unknown>;
  if (!isRatio(rules.dictationMin) || !isRatio(rules.shadowingMin)) {
    return false;
  }
  const day7 = rules.day7 as Record<string, unknown> | null | undefined;
  if (typeof day7 !== "object" || day7 === null) return false;
  if (day7.kind === "improve") return true;
  return day7.kind === "score" && isRatio(day7.min);
}

/** A practice's rules, or the defaults when it has none. */
export function passRulesOf(progress: { rules?: PassRules } | null): PassRules {
  return progress?.rules ?? DEFAULT_PASS_RULES;
}

export function sameRules(a: PassRules, b: PassRules): boolean {
  return (
    a.dictationMin === b.dictationMin &&
    a.shadowingMin === b.shadowingMin &&
    a.day7.kind === b.day7.kind &&
    (a.day7.kind !== "score" ||
      (b.day7.kind === "score" && a.day7.min === b.day7.min))
  );
}

/** Whether a dictation day's accuracy finishes it. */
export function meetsDictationMin(score: number, rules: PassRules): boolean {
  return score + EPSILON >= rules.dictationMin;
}

/** Whether a shadowing attempt's coverage counts the sentence as read. */
export function meetsShadowingMin(coverage: number, rules: PassRules): boolean {
  return coverage + EPSILON >= rules.shadowingMin;
}

/** Whether the week passes, from Day 1's and Day 7's (weighted) accuracy. */
export function passesWeek(
  day1: number,
  day7: number,
  rules: PassRules,
): boolean {
  if (rules.day7.kind === "score") return day7 + EPSILON >= rules.day7.min;
  // Nothing beats 100%: matching a perfect Day 1 passes.
  if (day1 + EPSILON >= 1) return day7 + EPSILON >= 1;
  return day7 > day1 + EPSILON;
}
