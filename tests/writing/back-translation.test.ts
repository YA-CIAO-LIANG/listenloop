import { describe, expect, it } from "vitest";
import { writingPrompts } from "@/data/writing";
import {
  BACK_MAX,
  BACK_MIN,
  backTranslationItems,
  checkBack,
  fixedSentences,
  itemMode,
  meaningOverlap,
  modelSentences,
  modelSentencesAligned,
} from "@/lib/writing/back-translation";
import type { WritingFeedback } from "@/lib/writing/feedback";

/** The daily back-translation (D195). */
const prompt = writingPrompts.find((p) => p.id === "daily-perfect-weekend")!;
const ESSAY =
  "My perfect weekend would start slowly. On Saturday he go to the park with me. We eat a apple and talk about school.";

const feedback = (issues: WritingFeedback["issues"]): WritingFeedback =>
  ({
    rubric: "general",
    criteria: [],
    issues,
    more: [],
    strengths: [],
    summary: "",
    total: 0,
    max: 20,
    percent: 0,
    declined: undefined,
  }) as unknown as WritingFeedback;

const REVIEW = feedback([
  {
    quote: "he go",
    type: "verb",
    why: "…",
    suggestion: "he goes",
    zh: "星期六他和我一起去公園。",
  },
  { quote: "a apple", type: "article", why: "…", suggestion: "an apple" },
]);

describe("model sentences", () => {
  it("every official prompt has Chinese for each model sentence", () => {
    for (const p of writingPrompts) {
      expect(modelSentencesAligned(p), p.id).toBe(true);
      expect(
        modelSentences(p).every((s) => s.zh),
        p.id,
      ).toBe(true);
    }
  });

  it("keeps titles like Dr. in their sentence", () => {
    const sentences = modelSentences({
      model: {
        en: ["Dear Dr. Hughes, I am sorry. It was late."],
        zh: ["親愛的 Hughes 博士，我很抱歉。那時很晚了。"],
      },
    });
    expect(sentences.map((s) => s.en)).toEqual([
      "Dear Dr. Hughes, I am sorry.",
      "It was late.",
    ]);
  });
});

describe("the day's sentences", () => {
  it("without a review: model sentences, 5–8 a day, different each day", () => {
    const days = ([2, 3, 4, 5, 6] as const).map((day) =>
      backTranslationItems({ prompt, day1: { essay: ESSAY }, day }),
    );
    for (const items of days) {
      expect(items.length).toBeGreaterThanOrEqual(BACK_MIN);
      expect(items.length).toBeLessThanOrEqual(BACK_MAX);
      expect(items.every((i) => i.source === "model" && i.zh)).toBe(true);
    }
    expect(days[0].map((i) => i.en)).not.toEqual(days[1].map((i) => i.en));
  });

  it("with a review: the corrected sentences first, with their meaning", () => {
    const items = backTranslationItems({
      prompt,
      day1: { essay: ESSAY, feedback: REVIEW },
      day: 2,
    });
    expect(items[0]).toEqual({
      en: "On Saturday he goes to the park with me.",
      zh: "星期六他和我一起去公園。",
      source: "fix",
    });
    expect(items[1]).toEqual({
      en: "We eat an apple and talk about school.",
      source: "fix",
    });
    expect(items.slice(2).every((i) => i.source === "model")).toBe(true);
  });

  it("a custom prompt: the corrected sentences, or the learner's own", () => {
    const custom = { model: { en: [], zh: [] }, patterns: [] };
    expect(
      backTranslationItems({
        prompt: custom,
        day1: { essay: ESSAY, feedback: REVIEW },
        day: 2,
      }).map((i) => i.source),
    ).toEqual(["fix", "fix"]);
    expect(
      backTranslationItems({
        prompt: custom,
        day1: { essay: ESSAY },
        day: 3,
      }).map((i) => i.source),
    ).toEqual(["own", "own", "own"]);
  });

  it("leaves out a declined review", () => {
    expect(fixedSentences(ESSAY, { ...REVIEW, declined: "off-task" })).toEqual(
      [],
    );
  });
});

describe("checking an answer", () => {
  const item = {
    en: "I paid $5 for 2 apples.",
    zh: "我花五美元買了兩顆蘋果。",
    source: "model" as const,
  };

  it("English like dictation: numbers in any form", () => {
    expect(
      checkBack(item, "listen-write", "i paid five dollars for two apples"),
    ).toMatchObject({ right: true, score: 1 });
    expect(checkBack(item, "read-zh", "I pay 5 dollars for apples").right).toBe(
      false,
    );
  });

  it("Chinese by meaning, loosely", () => {
    expect(
      meaningOverlap("我花五美元買了兩顆蘋果。", "我花了五美元買兩顆蘋果"),
    ).toBeGreaterThan(0.6);
    expect(checkBack(item, "listen-zh", "我花五美元買蘋果").right).toBe(true);
    expect(checkBack(item, "listen-zh", "今天天氣很好").right).toBe(false);
  });

  it("without a meaning, the Chinese modes fall back to listening", () => {
    const own = { en: "We eat an apple.", source: "own" as const };
    expect(itemMode(own, "read-zh")).toBe("listen-write");
    expect(itemMode(own, "listen-zh")).toBe("listen-write");
    expect(itemMode(item, "read-zh")).toBe("read-zh");
  });
});
