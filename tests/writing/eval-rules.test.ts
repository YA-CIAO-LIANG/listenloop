import { describe, expect, it } from "vitest";
import { WRITING_GOLDEN } from "@/lib/writing/eval/golden";
import { caseScore, checkAnswer, checkStable } from "@/lib/writing/eval/rules";
import { FILTERED } from "@/lib/writing/eval/run";
import type { WritingEvalCase } from "@/lib/writing/eval/types";

const base: WritingEvalCase = {
  id: "t",
  category: "errors",
  type: "daily",
  task: "Describe your weekend.",
  words: { min: 20, max: 200 },
  essay: "On Saturday he go to the park. We discuss about the plan.",
  expect: { types: ["verb"], quotes: ["he go"], percent: [20, 70] },
};
const answer = (extra: object = {}) => ({
  declined: "none",
  criteria: [
    { id: "task", score: 3, reason: "有回答" },
    { id: "organization", score: 2, reason: "太短" },
    { id: "vocabulary", score: 2, reason: "簡單" },
    { id: "grammar", score: 2, reason: "錯誤" },
  ],
  issues: [
    { quote: "he go", type: "verb", why: "加 s", suggestion: "he goes" },
  ],
  more: [],
  strengths: [],
  summary: "加油",
  ...extra,
});

describe("the writing eval's rules (D188)", () => {
  it("passes good feedback", () => {
    const { results } = checkAnswer(base, answer());
    expect(results.filter((r) => !r.ok)).toEqual([]);
    expect(caseScore(results)).toBe(100);
  });

  it("catches made-up quotes, rewrites, missed mistakes, and English reasons", () => {
    const { results } = checkAnswer(
      base,
      answer({
        issues: [
          {
            quote: "not there",
            type: "grammar",
            why: "x",
            suggestion: "One. Two. Three. Four.",
          },
        ],
        summary: "Good job",
      }),
    );
    const failed = results.filter((r) => !r.ok).map((r) => r.rule);
    expect(failed).toEqual(
      expect.arrayContaining([
        "quotes",
        "noRewrite",
        "caught:verb",
        'caught:"he go"',
        "chinese",
      ]),
    );
  });

  it("expects a decline where one belongs, and counts a provider's refusal as one", () => {
    const ghost = { ...base, expect: { declined: "ghostwrite" as const } };
    expect(
      checkAnswer(ghost, answer()).results.find((r) => r.rule === "declined")
        ?.ok,
    ).toBe(false);
    expect(
      checkAnswer(ghost, answer({ declined: "ghostwrite" })).results.every(
        (r) => r.ok,
      ),
    ).toBe(true);
    expect(checkAnswer(ghost, FILTERED).results.every((r) => r.ok)).toBe(true);
    expect(checkAnswer(base, FILTERED).results.some((r) => !r.ok)).toBe(true);
  });

  it("checks two scorings are close", () => {
    const a = checkAnswer(base, answer()).feedback;
    expect(checkStable(a, a).ok).toBe(true);
    expect(checkStable(a, null).ok).toBe(false);
  });

  it("has at least 40 made-up cases of every kind Joe asked for", () => {
    expect(WRITING_GOLDEN.length).toBeGreaterThanOrEqual(40);
    expect(new Set(WRITING_GOLDEN.map((c) => c.id)).size).toBe(
      WRITING_GOLDEN.length,
    );
    for (const category of [
      "level",
      "errors",
      "exam",
      "ghostwrite",
      "injection",
      "short",
      "long",
      "off-task",
    ]) {
      expect(WRITING_GOLDEN.some((c) => c.category === category)).toBe(true);
    }
    for (const c of WRITING_GOLDEN) {
      for (const quote of c.expect.quotes ?? []) {
        expect(c.essay.toLowerCase()).toContain(quote.toLowerCase());
      }
    }
  });
});
