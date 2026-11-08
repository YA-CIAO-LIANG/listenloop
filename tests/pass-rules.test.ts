import { describe, expect, it } from "vitest";
import {
  isBelowMinimum,
  restartDictation,
  startDictation,
  submitAnswer,
} from "@/lib/dictation";
import {
  DEFAULT_PASS_RULES,
  isPassRules,
  passesWeek,
  passRulesOf,
  sameRules,
} from "@/lib/pass-rules";
import { parseProgress, type Progress } from "@/lib/progress";
import type { Sentence } from "@/lib/videos";

const sentences: Sentence[] = [
  { i: 0, start: 0, end: 1, en: "Go home.", zh: "回家。" },
  { i: 1, start: 1, end: 2, en: "We moved to the city.", zh: "我們搬到城市。" },
];

describe("pass rules (D92)", () => {
  it("defaults: any score finishes dictation, 60% shadowing, beat Day 1", () => {
    expect(DEFAULT_PASS_RULES).toEqual({
      dictationMin: 0,
      shadowingMin: 0.6,
      day7: { kind: "improve" },
    });
    expect(passRulesOf(null)).toBe(DEFAULT_PASS_RULES);
  });

  it("'improve' needs Day 7 above Day 1; a perfect Day 1 needs a perfect Day 7", () => {
    const rules = DEFAULT_PASS_RULES;
    expect(passesWeek(0.6, 0.61, rules)).toBe(true);
    expect(passesWeek(0.6, 0.6, rules)).toBe(false);
    expect(passesWeek(0.6, 0.5, rules)).toBe(false);
    expect(passesWeek(1, 1, rules)).toBe(true);
    expect(passesWeek(1, 0.99, rules)).toBe(false);
  });

  it("'score' needs Day 7 at the minimum, whatever Day 1 was", () => {
    const rules = {
      ...DEFAULT_PASS_RULES,
      day7: { kind: "score", min: 0.8 },
    } as const;
    expect(passesWeek(0.9, 0.8, rules)).toBe(true);
    // A sum of fractions just under 0.8 still counts as 80%.
    expect(passesWeek(0.9, 0.1 + 0.7, rules)).toBe(true);
    expect(passesWeek(0.1, 0.79, rules)).toBe(false);
  });

  it("validates saved rules", () => {
    expect(isPassRules(DEFAULT_PASS_RULES)).toBe(true);
    expect(
      isPassRules({ ...DEFAULT_PASS_RULES, day7: { kind: "score", min: 2 } }),
    ).toBe(false);
    expect(isPassRules({ ...DEFAULT_PASS_RULES, shadowingMin: "60%" })).toBe(
      false,
    );
    const progress = startDictation(null, "sintel", 1, 2, "2026-11-08");
    expect(parseProgress({ ...progress, rules: { dictationMin: 1 } })).toBe(
      null,
    );
    expect(
      parseProgress({ ...progress, rules: DEFAULT_PASS_RULES })?.rules,
    ).toEqual(DEFAULT_PASS_RULES);
  });

  it("compares rules by value", () => {
    expect(sameRules(DEFAULT_PASS_RULES, { ...DEFAULT_PASS_RULES })).toBe(true);
    expect(
      sameRules(DEFAULT_PASS_RULES, {
        ...DEFAULT_PASS_RULES,
        day7: { kind: "score", min: 0.8 },
      }),
    ).toBe(false);
  });
});

describe("dictation minimum (D92)", () => {
  const today = "2026-11-08";
  const withMin = (min: number): Progress => ({
    ...startDictation(null, "sintel", 1, 2, today),
    rules: { ...DEFAULT_PASS_RULES, dictationMin: min },
  });

  it("finishes the day at or above the minimum", () => {
    let progress = withMin(0.5);
    progress = submitAnswer(progress, 1, 0, "go home", sentences, today);
    progress = submitAnswer(progress, 1, 1, "we moved", sentences, today);
    expect(progress.days[1]?.done).toBe(true);
  });

  it("keeps the day open below it, then starts it over", () => {
    let progress = withMin(0.9);
    progress = submitAnswer(progress, 1, 0, "go home", sentences, today);
    progress = submitAnswer(progress, 1, 1, "we moved", sentences, today);
    expect(progress.days[1]).toMatchObject({ done: false });
    expect(progress.days[1]?.score).toBeLessThan(0.9);
    expect(isBelowMinimum(progress, 1)).toBe(true);

    const again = restartDictation(progress, 1);
    expect(again.days[1]).toEqual({ done: false, answers: [null, null] });
    expect(isBelowMinimum(again, 1)).toBe(false);
  });

  it("doesn't restart a day in progress or done", () => {
    const progress = withMin(0);
    expect(restartDictation(progress, 1)).toBe(progress);
  });
});
