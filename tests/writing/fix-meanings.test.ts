import { describe, expect, it } from "vitest";
import { fixedSentences } from "@/lib/writing/back-translation";
import type { WritingFeedback } from "@/lib/writing/feedback";
import {
  fixesToTranslate,
  MAX_FIX_MEANINGS,
  withFixMeanings,
} from "@/lib/writing/fix-meanings";

/** The corrected sentences' Chinese meanings (D206). */
const ESSAY =
  "My perfect weekend would start slowly. On Saturday he go to the park with me. We eat a apple and talk about school. Fun day.";

const feedback = (
  issues: WritingFeedback["issues"],
  more: WritingFeedback["more"] = [],
  declined?: WritingFeedback["declined"],
): WritingFeedback => ({
  rubric: "general",
  criteria: [],
  percent: 50,
  issues,
  more,
  strengths: [],
  summary: "",
  declined,
});

const issue = (quote: string, suggestion: string) => ({
  quote,
  type: "grammar" as const,
  why: "…",
  suggestion,
});

describe("the corrected sentences' meanings (D206)", () => {
  it("asks for each corrected sentence that can be written back, once", () => {
    const review = feedback(
      [issue("he go", "he goes"), issue("a apple", "an apple")],
      // The same sentence again, and one too short to practise.
      [issue("he go to", "he goes to"), issue("Fun day", "Great day")],
    );
    const fixes = fixesToTranslate(ESSAY, review);
    expect(fixes.map((f) => f.en)).toEqual([
      "On Saturday he goes to the park with me.",
      "We eat an apple and talk about school.",
    ]);
    expect(fixes[0].places).toEqual([
      { list: "issues", index: 0 },
      { list: "more", index: 0 },
    ]);
  });

  it("puts each meaning on its issues, and the sentences get it", () => {
    const review = feedback(
      [issue("he go", "he goes"), issue("a apple", "an apple")],
      [issue("he go to", "he goes to")],
    );
    const fixes = fixesToTranslate(ESSAY, review);
    const next = withFixMeanings(review, fixes, [
      "星期六他和我一起去公園。",
      "我們吃一顆蘋果，聊學校的事。",
    ]);
    expect(next.issues.map((i) => i.zh)).toEqual([
      "星期六他和我一起去公園。",
      "我們吃一顆蘋果，聊學校的事。",
    ]);
    expect(next.more[0].zh).toBe("星期六他和我一起去公園。");
    // The review itself isn't changed.
    expect(review.issues[0].zh).toBeUndefined();
    expect(fixedSentences(ESSAY, next).map((s) => s.zh)).toEqual([
      "星期六他和我一起去公園。",
      "我們吃一顆蘋果，聊學校的事。",
    ]);
  });

  it("leaves out a meaning that isn't Chinese, and a wrong count", () => {
    const review = feedback([issue("he go", "he goes")]);
    const fixes = fixesToTranslate(ESSAY, review);
    expect(withFixMeanings(review, fixes, ["On Saturday…"]).issues[0].zh).toBe(
      undefined,
    );
    expect(withFixMeanings(review, fixes, []).issues[0].zh).toBeUndefined();
    // Full-width digits become half-width, like every translation (D117).
    expect(
      withFixMeanings(review, fixes, ["星期六３點他去公園。"]).issues[0].zh,
    ).toBe("星期六3點他去公園。");
  });

  it("asks nothing for a declined essay, and at most 8 sentences", () => {
    expect(
      fixesToTranslate(
        ESSAY,
        feedback([issue("he go", "he goes")], [], "off-task"),
      ),
    ).toEqual([]);
    const long = Array.from(
      { length: 12 },
      (_, n) => `Sentence number ${n} is here today.`,
    ).join(" ");
    const many = feedback(
      [],
      Array.from({ length: 12 }, (_, n) =>
        issue(`number ${n} is`, `number ${n} was`),
      ),
    );
    expect(fixesToTranslate(long, many)).toHaveLength(MAX_FIX_MEANINGS);
  });
});
