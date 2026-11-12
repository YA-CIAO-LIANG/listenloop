/**
 * The AI eval's settings (D150), in one place.
 */

/**
 * The most one `npm run eval:record` may spend, in US$: the worst case
 * of what it would call is checked before it starts, and it stops before
 * a call that could pass this.
 */
export const EVAL_BUDGET_USD = 0.1;

/**
 * The model the golden set is recorded with: the one production uses
 * (AZURE_OPENAI_MODEL). Changing the model changes every request, so the
 * eval has to be recorded again and compared with the old one.
 */
export const EVAL_MODEL = "gpt-5-mini";

/** A case's score out of 100: its rules, then the AI judge's 1–5. */
export const EVAL_WEIGHTS = { rules: 60, judge: 40 } as const;

/**
 * The judge's instructions version. Bump it when lib/evals/judge.ts
 * changes the way answers are graded: scores across judge versions
 * aren't comparable, so the change needs an exception (evals/exceptions.json).
 */
export const JUDGE_VERSION = 1;

/** How many cases the report suggests checking by hand. */
export const SPOT_CHECKS = 10;

/** Where the golden set's recordings and results live. */
export const EVAL_PATHS = {
  fixtures: "tests/fixtures/eval",
  baseline: "evals/baseline.json",
  report: "evals/report.md",
  exceptions: "evals/exceptions.json",
} as const;
