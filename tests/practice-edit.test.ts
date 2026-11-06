import { describe, expect, it } from "vitest";
import {
  badNotes,
  editSentences,
  planEdit,
  rowsFromSentences,
} from "@/lib/custom-practice/edit";

const notes = {
  vocab: [{ word: "home", pos: "n.", zh: "家", example: "I'm home." }],
  grammar: [],
};
const saved = [
  { en: "Go home.", zh: "回家。", notes },
  { en: "We moved.", zh: "我們搬家了。", notes: { vocab: [], grammar: [] } },
];
const hash = (c: string) => `${c.repeat(64)}.mp3`;

describe("editSentences", () => {
  it("sends unchanged rows as they are", () => {
    expect(editSentences(rowsFromSentences(saved))).toEqual(saved);
  });

  it("asks a changed row for new Chinese and notes, unless the author wrote them", () => {
    const [first, second] = rowsFromSentences(saved);
    expect(
      editSentences([
        { ...first, en: "Go home now." },
        {
          ...second,
          en: "We moved away.",
          zh: "我們搬走了。",
          notesEdited: true,
        },
      ]),
    ).toEqual([
      { en: "Go home now.", zh: "", notes: null },
      {
        en: "We moved away.",
        zh: "我們搬走了。",
        notes: { vocab: [], grammar: [] },
      },
    ]);
  });

  it("treats a new row as changed", () => {
    expect(
      editSentences([
        {
          key: 9,
          en: "Hello.",
          zh: "",
          notes: null,
          original: null,
          notesEdited: false,
        },
      ]),
    ).toEqual([{ en: "Hello.", zh: "", notes: null }]);
  });
});

describe("planEdit", () => {
  const current = {
    voice: "us-female",
    sentences: [
      { en: "Go home.", audio_path: hash("a"), notes },
      { en: "We moved.", audio_path: hash("b"), notes: null },
    ],
  };

  it("keeps the audio and notes of unchanged English, reordered or not", () => {
    const plan = planEdit(current, {
      voice: "us-female",
      sentences: [
        { en: "We moved.", zh: "我們搬家了。", notes: null },
        { en: "Go home.", zh: "回家。", notes: null },
        { en: "New one.", zh: "", notes: null },
      ],
    });
    expect(plan.sentences).toEqual([
      {
        en: "We moved.",
        zh: "我們搬家了。",
        audio_path: hash("b"),
        notes: null,
      },
      { en: "Go home.", zh: "回家。", audio_path: hash("a"), notes },
      { en: "New one.", zh: "", audio_path: null, notes: null },
    ]);
    expect(plan.translate).toEqual([2]);
  });

  it("makes all audio again with a new voice", () => {
    const plan = planEdit(current, {
      voice: "gb-male",
      sentences: [{ en: "Go home.", zh: "回家。", notes: null }],
    });
    expect(plan.sentences[0]).toMatchObject({ audio_path: null, notes });
  });
});

describe("badNotes", () => {
  it("accepts null and complete notes", () => {
    expect(badNotes([{ notes: null }, { notes }, {}])).toBeNull();
  });

  it("finds notes with an empty field or over the limit", () => {
    expect(
      badNotes([
        { notes },
        {
          notes: {
            vocab: [{ word: "", pos: "n.", zh: "x", example: "y" }],
            grammar: [],
          },
        },
      ]),
    ).toBe(1);
    const three = Array.from({ length: 3 }, (_, i) => ({
      word: `w${i}`,
      pos: "n.",
      zh: "字",
      example: "Ex.",
    }));
    expect(badNotes([{ notes: { vocab: three, grammar: [] } }])).toBe(0);
    expect(badNotes([{ notes: "x" }])).toBe(0);
  });
});
