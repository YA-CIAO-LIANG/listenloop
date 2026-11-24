import { describe, expect, it } from "vitest";
import { writingPrompts } from "@/data/writing";
import {
  BACK_MAX,
  BACK_MIN,
  answerRun,
  backNotebookItems,
  backTranslationItems,
  extraBackItems,
  newRun,
  nextIndex,
  runSummary,
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

describe("a set as it goes (D199)", () => {
  const items = backTranslationItems({ prompt, day1: undefined, day: 2 });
  const right = (en: string) => ({
    ...checkBack({ en, source: "model" }, "listen-write", en),
    answer: en,
  });

  it("saves each answer, carries on at the first one left, keeps first answers", () => {
    let run = newRun(items);
    expect(nextIndex(run)).toBe(0);
    run = answerRun(run, 0, right(items[0].en));
    run = answerRun(run, 1, {
      ...checkBack(items[1], "listen-write", "no"),
      answer: "no",
    });
    expect(nextIndex(run)).toBe(2);
    expect(run.done).toBeUndefined();
    // A second answer to the same sentence doesn't count.
    expect(answerRun(run, 1, right(items[1].en))).toBe(run);
    // Out of range: nothing changes.
    expect(answerRun(run, 99, right("x"))).toBe(run);
    for (let i = 2; i < items.length; i++)
      run = answerRun(run, i, right(items[i].en));
    expect(run.done).toBe(true);
    expect(nextIndex(run)).toBe(items.length);
    const summary = runSummary(run);
    expect(summary).toMatchObject({
      right: items.length - 1,
      answered: items.length,
      total: items.length,
    });
    expect(summary.percent).toBeLessThan(100);
  });

  it("the wrong ones go to the notebook, with the Chinese and what was written", () => {
    let run = newRun(items);
    run = answerRun(run, 0, {
      ...checkBack(items[0], "listen-write", "nothing like it"),
      answer: "nothing like it",
    });
    run = answerRun(run, 1, right(items[1].en));
    const notes = backNotebookItems(prompt.id, run);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({
      kind: "back",
      answer: items[0].en,
      text: items[0].zh,
      note: "nothing like it",
    });
    expect(notes[0].id).toBe(backNotebookItems(prompt.id, run)[0].id);
  });

  it("extra practice: new sentences, never the day's, next set different", () => {
    const today = new Set(items.map((i) => i.en));
    const first = extraBackItems({
      prompt,
      day1: { essay: ESSAY, feedback: REVIEW },
      day: 2,
      round: 1,
      exclude: items,
    });
    expect(first.length).toBeGreaterThan(0);
    expect(first.some((i) => today.has(i.en))).toBe(false);
    const second = extraBackItems({
      prompt,
      day1: { essay: ESSAY, feedback: REVIEW },
      day: 2,
      round: 2,
      exclude: items,
      seen: first,
    });
    expect(second.some((i) => today.has(i.en))).toBe(false);
    if (second.length && first.length) {
      expect(second.map((i) => i.en)).not.toEqual(first.map((i) => i.en));
    }
  });

  it("extra practice: nothing when the day used every sentence", () => {
    const tiny = {
      model: {
        en: ["I like long walks in the park."],
        zh: ["我喜歡在公園散步。"],
      },
      patterns: [],
    };
    const day = backTranslationItems({ prompt: tiny, day1: undefined, day: 2 });
    expect(
      extraBackItems({
        prompt: tiny,
        day1: undefined,
        day: 2,
        round: 1,
        exclude: day,
      }),
    ).toEqual([]);
  });
});
