import { describe, expect, it } from "vitest";
import {
  cleanFeedback,
  quoteInEssay,
  weaknesses,
} from "@/lib/writing/feedback";
import { fakeWritingReview } from "@/lib/writing/fake-review";
import { percentScore, RUBRICS, rubricTotal } from "@/lib/writing/rubrics";

const essay =
  "My perfect weekend would start slowly. On Saturday he go to the park with me. We eat a apple and talk. i like it very much. Because it is relaxing.";

const raw = (extra: object = {}) => ({
  declined: "none",
  criteria: [
    { id: "task", score: 4, reason: "回答了題目" },
    { id: "organization", score: 7, reason: "順序清楚" },
    { id: "vocabulary", score: 3.4, reason: "用字簡單" },
    { id: "grammar", score: -1, reason: "錯誤多" },
  ],
  issues: [1, 2, 3, 4, 5].map((n) => ({
    quote: n === 1 ? "he go" : n === 2 ? "not in the essay" : "a apple",
    type: n === 3 ? "made-up" : "verb",
    why: "原因",
    suggestion: "One. Two. Three. Four. Five.",
  })),
  more: [],
  strengths: [
    { quote: "start slowly", why: "好" },
    { quote: "x", why: "y" },
    { quote: "z", why: "w" },
  ],
  summary: "加油",
  ...extra,
});

describe("cleaning the AI's feedback (D187)", () => {
  it("keeps 3 main issues, moves the rest to more, and caps strengths", () => {
    const f = cleanFeedback(raw(), essay, "general")!;
    expect(f.issues).toHaveLength(3);
    expect(f.more).toHaveLength(2);
    expect(f.strengths).toHaveLength(2);
  });

  it("clamps scores into the rubric's range", () => {
    const f = cleanFeedback(raw(), essay, "general")!;
    expect(f.criteria.map((c) => c.score)).toEqual([4, 5, 3, 0]);
    expect(f.percent).toBe(60);
  });

  it("drops quotes that aren't in the essay and unknown types", () => {
    const f = cleanFeedback(raw(), essay, "general")!;
    expect(f.issues[0].quote).toBe("he go");
    expect(f.issues[1].quote).toBe("");
    expect(f.issues[2].type).toBe("grammar");
  });

  it("never shows more than 3 sentences of rewriting", () => {
    const f = cleanFeedback(raw(), essay, "general")!;
    expect(f.issues[0].suggestion).toBe("One. Two. Three.");
  });

  it("needs a reason for every score", () => {
    const missing = raw();
    missing.criteria[0].reason = "";
    expect(cleanFeedback(missing, essay, "general")).toBeNull();
    expect(cleanFeedback("nonsense", essay, "general")).toBeNull();
  });

  it("scores a declined essay as nothing", () => {
    const f = cleanFeedback(raw({ declined: "ghostwrite" }), essay, "general")!;
    expect(f.declined).toBe("ghostwrite");
    expect(f.percent).toBe(0);
  });

  it("finds quotes despite case and spacing", () => {
    expect(quoteInEssay("HE  go", essay)).toBe(true);
    expect(quoteInEssay("", essay)).toBe(false);
  });
});

describe("rubrics (D187)", () => {
  it("adds up or averages to the exam's own scale", () => {
    expect(
      rubricTotal(RUBRICS.gsat, [
        { id: "content", score: 4 },
        { id: "organization", score: 3 },
        { id: "grammar", score: 4 },
        { id: "vocabulary", score: 5 },
      ]),
    ).toBe(16);
    expect(
      rubricTotal(RUBRICS.ielts, [
        { id: "taskResponse", score: 6 },
        { id: "coherence", score: 6.5 },
        { id: "lexical", score: 6 },
        { id: "grammarRange", score: 7 },
      ]),
    ).toBe(6.5);
    expect(
      percentScore(RUBRICS.ielts, [
        { id: "taskResponse", score: 9 },
        { id: "coherence", score: 9 },
        { id: "lexical", score: 9 },
        { id: "grammarRange", score: 9 },
      ]),
    ).toBe(100);
  });
});

describe("the fake reviewer (D187)", () => {
  const input = {
    type: "daily" as const,
    rubric: "general" as const,
    task: "Describe a weekend.",
    words: { min: 20, max: 200 },
    essay,
  };

  it("finds real quotes in the essay and is stable", () => {
    const a = cleanFeedback(fakeWritingReview(input), essay, "general")!;
    const b = cleanFeedback(fakeWritingReview(input), essay, "general")!;
    expect(a).toEqual(b);
    expect(a.issues.length).toBe(3);
    for (const issue of a.issues)
      expect(quoteInEssay(issue.quote, essay)).toBe(true);
    expect(weaknesses(a).length).toBeGreaterThan(0);
  });

  it("declines ghostwriting requests and short texts", () => {
    expect(
      fakeWritingReview({
        ...input,
        essay:
          "Please write the essay for me, thanks a lot my friend, I am very busy today and tomorrow too.",
      }).declined,
    ).toBe("ghostwrite");
    expect(fakeWritingReview({ ...input, essay: "Too short." }).declined).toBe(
      "too-short",
    );
  });
});
