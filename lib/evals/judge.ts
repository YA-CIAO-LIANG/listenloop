import type { JudgeGrade } from "./types";

/**
 * The AI judge (D150): the language model grades what rules can't
 * (faithful, natural, correct, fits the level). Its answers are recorded
 * like any other, so grading costs nothing after the first time.
 */
export const JUDGE_INSTRUCTIONS = [
  "You grade the output of one AI step in an English listening course for Taiwanese students (high school or university, around CEFR B1).",
  "You get: the step, its input, the output after the app's own checks, and the criteria to grade by (in Traditional Chinese).",
  "Grade only by the criteria. Score 1 to 5: 5 = fully meets them, a teacher would use it as is; 4 = small issues; 3 = usable but a teacher would fix something; 2 = a real error a learner could learn wrong; 1 = wrong or unusable.",
  "Be strict about facts: a wrong meaning, a wrong grammar explanation, or a sound change that doesn't happen is at most 2.",
  "Give reason: one or two short sentences in Traditional Chinese (Taiwan usage) naming the most important issue, or what makes it good.",
].join("\n");

export const JUDGE_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "integer", enum: [1, 2, 3, 4, 5] },
    reason: { type: "string" },
  },
  required: ["score", "reason"],
  additionalProperties: false,
} as const;

/** The judge's output cap: a score and a sentence or two. */
export const JUDGE_MAX_OUTPUT_TOKENS = 400;

/** What the judge reads. */
export type JudgeInput = {
  operation: string;
  input: unknown;
  output: unknown;
  criteria: string;
};

/** The chat completions body (the deployment is filled in when sent). */
export function judgeRequestBody(deployment: string, input: JudgeInput) {
  return {
    model: deployment,
    messages: [
      { role: "system", content: JUDGE_INSTRUCTIONS },
      { role: "user", content: JSON.stringify(input) },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "grade", strict: true, schema: JUDGE_SCHEMA },
    },
    max_completion_tokens: JUDGE_MAX_OUTPUT_TOKENS,
    reasoning_effort: "minimal",
  };
}

/** The judge's answer, checked; null when it isn't a grade. */
export function parseGrade(value: unknown): JudgeGrade | null {
  const grade = (value ?? {}) as { score?: unknown; reason?: unknown };
  return Number.isInteger(grade.score) &&
    (grade.score as number) >= 1 &&
    (grade.score as number) <= 5 &&
    typeof grade.reason === "string"
    ? { score: grade.score as number, reason: grade.reason.trim() }
    : null;
}
