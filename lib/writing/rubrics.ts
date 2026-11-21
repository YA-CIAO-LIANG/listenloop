import type { RubricId } from "./types";

/**
 * How each kind of prompt is scored (D187). Every rubric has four
 * criteria on the exam's own scale, so the result reads like the real
 * thing (an IELTS band, a GSAT score out of 20); for comparing Day 1 with
 * Day 7, pass rules, and charts, each is also turned into 0–100.
 *
 * The exam scales follow what the exams publish in outline; the criteria
 * names are theirs, the descriptors the model uses are our summary (not
 * official band descriptors), and the product says the score is an
 * estimate.
 */
export const CRITERION_IDS = [
  "task",
  "organization",
  "vocabulary",
  "grammar",
  "taskResponse",
  "taskAchievement",
  "coherence",
  "lexical",
  "grammarRange",
  "development",
  "languageUse",
  "accuracy",
  "content",
] as const;
export type CriterionId = (typeof CRITERION_IDS)[number];

export type Criterion = {
  id: CriterionId;
  /** The highest score on this criterion. */
  max: number;
  /** Steps a score may take: 1 (whole) or 0.5 (IELTS bands). */
  step: number;
};

export type Rubric = {
  id: RubricId;
  criteria: readonly Criterion[];
  /** How the total shows: an average band, or a sum out of the maximum. */
  total: "average" | "sum";
};

const four = (
  id: RubricId,
  names: readonly CriterionId[],
  max: number,
  step: number,
  total: Rubric["total"],
): Rubric => ({
  id,
  criteria: names.map((name) => ({ id: name, max, step })),
  total,
});

export const RUBRICS: Readonly<Record<RubricId, Rubric>> = {
  general: four(
    "general",
    ["task", "organization", "vocabulary", "grammar"],
    5,
    1,
    "sum",
  ),
  ielts: four(
    "ielts",
    ["taskResponse", "coherence", "lexical", "grammarRange"],
    9,
    0.5,
    "average",
  ),
  "ielts-task1": four(
    "ielts-task1",
    ["taskAchievement", "coherence", "lexical", "grammarRange"],
    9,
    0.5,
    "average",
  ),
  toefl: four(
    "toefl",
    ["development", "organization", "languageUse", "accuracy"],
    5,
    1,
    "average",
  ),
  gept: four(
    "gept",
    ["task", "organization", "vocabulary", "grammar"],
    5,
    1,
    "sum",
  ),
  gsat: four(
    "gsat",
    ["content", "organization", "grammar", "vocabulary"],
    5,
    1,
    "sum",
  ),
};

export type CriterionScore = { id: CriterionId; score: number };

/** Rounds into the criterion's range and step. */
export function clampScore(criterion: Criterion, value: number): number {
  if (!Number.isFinite(value)) return 0;
  const stepped = Math.round(value / criterion.step) * criterion.step;
  return Math.min(criterion.max, Math.max(0, stepped));
}

/**
 * The total on the rubric's own scale: IELTS averages to the nearest half
 * band; TOEFL averages to the nearest half point; the others add up.
 */
export function rubricTotal(rubric: Rubric, scores: readonly CriterionScore[]) {
  const values = rubric.criteria.map(
    (criterion) => scores.find((s) => s.id === criterion.id)?.score ?? 0,
  );
  const sum = values.reduce((a, b) => a + b, 0);
  if (rubric.total === "sum") return sum;
  return Math.round((sum / values.length) * 2) / 2;
}

/** The highest total on the rubric's own scale. */
export function rubricMax(rubric: Rubric): number {
  return rubric.total === "sum"
    ? rubric.criteria.reduce((a, c) => a + c.max, 0)
    : rubric.criteria[0].max;
}

/** 0–100, for comparing and charts. */
export function percentScore(
  rubric: Rubric,
  scores: readonly CriterionScore[],
): number {
  const total = rubric.criteria.reduce((a, criterion) => {
    const found = scores.find((s) => s.id === criterion.id)?.score ?? 0;
    return a + clampScore(criterion, found) / criterion.max;
  }, 0);
  return Math.round((total / rubric.criteria.length) * 100);
}
