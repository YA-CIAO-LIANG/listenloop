import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  fixesFor,
  halfWidth,
  halfWidthDeep,
  hasFullWidth,
  inconsistentNames,
  NOTES_TARGET_CHARS,
  shortenNotes,
  textLength,
  unchangedSince,
  type HandFix,
} from "@/lib/content-fixes";
import { richNotesFromModel } from "@/lib/custom-practice/notes";
import {
  cleanRichNotes,
  parseRichNotes,
  type RichNotes,
} from "@/lib/custom-practice/rich-notes";

const fixture = JSON.parse(
  readFileSync("tests/fixtures/notes-v2-hard.json", "utf8"),
) as { answer: { sentences: (Record<string, unknown> & { en?: string })[] } };

/** Hard notes made long: every list full, every text long. */
function longNotes(): { en: string; notes: RichNotes } {
  const en =
    "If you're going to the library later, could you pick up the book I reserved, because I won't have time before class?";
  const example = (n: number) => ({
    en: `Example sentence number ${n} for this word.`,
    zh: `這是第 ${n} 個例句的翻譯，寫得比較長一點。`,
  });
  const notes: RichNotes = {
    v: 2,
    difficulty: "hard",
    highlights: [{ text: "pick up", note: "去拿、領取" }],
    vocab: ["library", "pick up", "reserved"].map((term, k) => ({
      term,
      inSentence: k === 1 ? "" : term,
      kind: "word",
      pos: "v.",
      zh: "說明".repeat(20),
      ipa: "/ˈtɛst/",
      collocations: ["one collocation", "two collocation", "three collocation"],
      examples: [example(1), example(2)],
    })),
    grammar: ["if clause", "because clause"].map((point) => ({
      point,
      quote: point === "if clause" ? "If you're going" : "because",
      explanation: "文法說明".repeat(20),
      examples: [example(1), example(2)],
      pitfall: "常見錯誤".repeat(15),
    })),
    chunks: [],
    connected: [
      { text: "going to", soundsLike: "goin-to", note: "連音".repeat(20) },
      { text: "pick up", soundsLike: "pi-kup", note: "連音".repeat(20) },
      { text: "won't have", soundsLike: "won-tav", note: "連音".repeat(20) },
    ],
  };
  return { en, notes };
}

describe("half-width (D117)", () => {
  it("turns full-width letters and digits into ordinary ones, not punctuation", () => {
    expect(halfWidth("請問４號月台在Ｂ車廂旁邊嗎？")).toBe(
      "請問4號月台在B車廂旁邊嗎？",
    );
    expect(hasFullWidth("４號")).toBe(true);
    expect(hasFullWidth("4號，好嗎？")).toBe(false);
    expect(halfWidthDeep({ a: ["１"], b: { c: "ｘ" }, d: 3 })).toEqual({
      a: ["1"],
      b: { c: "x" },
      d: 3,
    });
  });
});

describe("shortenNotes (D117)", () => {
  it("cuts the mildest things first until the notes fit", () => {
    const { en, notes } = longNotes();
    expect(textLength(notes)).toBeGreaterThan(NOTES_TARGET_CHARS);
    const { notes: short, steps } = shortenNotes(notes);
    expect(textLength(short)).toBeLessThanOrEqual(NOTES_TARGET_CHARS);
    expect(steps[0]).toBe("oneExample");
    // Still valid notes, with the highlight and the words in the sentence.
    const parsed = parseRichNotes(short, en);
    expect(parsed).not.toBeNull();
    expect(parsed!.highlights).toEqual(notes.highlights);
    expect(short.vocab.every((v) => v.examples.length === 1)).toBe(true);
    if (short.vocab.length === 2) {
      expect(short.vocab.map((v) => v.term)).toEqual(["library", "reserved"]);
    }
  });

  it("leaves notes that already fit alone", () => {
    const notes = cleanRichNotes(
      fixture.answer.sentences[0],
      String(fixture.answer.sentences[0].en ?? ""),
    );
    if (!notes) return;
    const { notes: same, steps } = shortenNotes(notes, 100_000);
    expect(same).toBe(notes);
    expect(steps).toEqual([]);
  });

  it("keeps new notes from the model short and half-width", () => {
    const { en, notes } = longNotes();
    const raw = {
      sentences: [
        {
          index: 0,
          ...notes,
          highlights: [{ text: "pick up", note: "第１個重點" }],
        },
      ],
    };
    const [made] = richNotesFromModel(raw, [en]);
    expect(textLength(made)).toBeLessThanOrEqual(NOTES_TARGET_CHARS);
    expect(made.highlights[0].note).toBe("第1個重點");
  });
});

describe("inconsistentNames (D117)", () => {
  it("finds a name kept in English in one translation and translated in another", () => {
    expect(
      inconsistentNames([
        { en: "Hi, this is Alex.", zh: "嗨，我是 Alex。" },
        { en: "Hello Alex, I'm Sam.", zh: "你好 Alex，我是 Sam。" },
        { en: "You are welcome, Alex.", zh: "不客氣，亞歷克斯。" },
        { en: "Thanks, Sam.", zh: "謝謝你，山姆。" },
      ]),
    ).toEqual([
      { name: "Alex", sentences: [2] },
      { name: "Sam", sentences: [3] },
    ]);
  });

  it("counts a name at a sentence's start once it's known as a name", () => {
    expect(
      inconsistentNames([
        { en: "Emo?", zh: "情緒搖滾？" },
        { en: "Get up, Emo!", zh: "起來，Emo！" },
      ]),
    ).toEqual([{ name: "Emo", sentences: [0] }]);
  });

  it("ignores names translated the same way everywhere, days, and sentence starts", () => {
    expect(
      inconsistentNames([
        { en: "Welcome to Lakeside University.", zh: "歡迎來到湖濱大學。" },
        { en: "See you at Lakeside on Monday.", zh: "週一在湖濱見。" },
        { en: "Monday works.", zh: "Monday 可以。" },
      ]),
    ).toEqual([]);
  });
});

describe("fixesFor (D117)", () => {
  const { notes } = longNotes();
  const sentences = [
    {
      i: 0,
      en: "Two tickets to Hillview.",
      zh: "兩張去希爾維的票。",
      notes: null,
    },
    { i: 1, en: "Is it platform 4?", zh: "是４號月台嗎？", notes: null },
    { i: 2, en: "Seats in car B.", zh: "Ｂ車廂的座位。", notes },
  ];
  const hand: HandFix[] = [
    {
      practiceId: "p1",
      sentence: 0,
      kind: "name",
      zh: "兩張到 Hillview 的票。",
      reason: "地名保留英文",
    },
    {
      practiceId: "p1",
      sentence: 1,
      kind: "translation",
      zh: "請問是４號月台嗎？",
      reason: "更自然",
    },
  ];

  it("makes hand-written, full-width, and long-notes fixes", () => {
    const fixes = fixesFor("p1", sentences, hand, 1_100);
    expect(
      fixes.map((f) => [f.sentenceIndex, f.field, f.kind, f.suggested]),
    ).toEqual([
      [0, "zh", "name", "兩張到 Hillview 的票。"],
      // A hand-written fix wins over the rule, and is made half-width too.
      [1, "zh", "translation", "請問是4號月台嗎？"],
      [2, "zh", "full-width", "B車廂的座位。"],
      [2, "notes", "long-notes", expect.any(Object)],
    ]);
    const long = fixes[3];
    expect(long.detail.before).toBe(textLength(notes));
    expect(long.detail.after).toBeLessThanOrEqual(NOTES_TARGET_CHARS);
    expect(long.current).toBe(notes);
  });

  it("skips a hand-written fix that's already in the material", () => {
    const fixes = fixesFor(
      "p1",
      [{ ...sentences[0], zh: "兩張到 Hillview 的票。" }],
      hand,
      1_100,
    );
    expect(fixes).toEqual([]);
  });

  it("tells whether the sentence changed since the fix was made", () => {
    expect(unchangedSince({ a: 1 }, { a: 1 })).toBe(true);
    expect(unchangedSince("old", "new")).toBe(false);
    expect(unchangedSince(null, undefined)).toBe(true);
  });
});
