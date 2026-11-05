import { describe, expect, it } from "vitest";
import {
  cleanDraft,
  PRACTICE_LIMITS,
  titleFromFileName,
  canSplitAt,
  joinText,
  mergeWithNext,
  splitRowAt,
} from "@/lib/custom-practice/draft";

const sentence = { en: "Hello there.", zh: "你好。" };
const draft = {
  title: "My text",
  sourceLanguage: "en",
  voice: "us-female",
  sentences: [sentence],
};

describe("cleanDraft", () => {
  it("accepts a draft and tidies whitespace", () => {
    expect(
      cleanDraft({
        title: "  My   text ",
        sourceLanguage: "zh",
        voice: "au-male",
        sentences: [{ en: " Hello\n there. ", zh: " 你好。 " }],
      }),
    ).toEqual({
      ok: true,
      draft: {
        title: "My text",
        sourceLanguage: "zh",
        voice: "au-male",
        sentences: [sentence],
      },
    });
  });

  it.each([
    ["no title", { ...draft, title: "  " }, "title"],
    ["a long title", { ...draft, title: "x".repeat(101) }, "title"],
    ["no sentences", { ...draft, sentences: [] }, "no-sentences"],
    ["a bad language", { ...draft, sourceLanguage: "fr" }, "no-sentences"],
    ["an unknown voice", { ...draft, voice: "fr-female" }, "voice"],
    [
      "too many sentences",
      {
        ...draft,
        sentences: Array(PRACTICE_LIMITS.sentences + 1).fill(sentence),
      },
      "too-many",
    ],
  ])("rejects %s", (_, input, problem) => {
    expect(cleanDraft(input)).toEqual({ ok: false, problem });
  });

  it("points at the first sentence with a problem", () => {
    expect(
      cleanDraft({ ...draft, sentences: [sentence, { en: " … ", zh: "" }] }),
    ).toEqual({ ok: false, problem: "sentence-empty", sentence: 1 });
    expect(
      cleanDraft({ ...draft, sentences: [{ en: "Hi", zh: "長".repeat(501) }] }),
    ).toEqual({ ok: false, problem: "sentence-too-long", sentence: 0 });
  });

  it("survives malformed input from the browser", () => {
    expect(cleanDraft(null)).toEqual({ ok: false, problem: "title" });
    expect(cleanDraft({ ...draft, sentences: [null, 3] as unknown[] })).toEqual(
      { ok: false, problem: "sentence-empty", sentence: 0 },
    );
  });
});

describe("titleFromFileName", () => {
  it("drops the extension", () => {
    expect(titleFromFileName("week 1 dialogue.txt")).toBe("week 1 dialogue");
    expect(titleFromFileName("notes")).toBe("notes");
  });
});

describe("merging and splitting review rows (e+ 4)", () => {
  const rows = [
    { en: "Dr. Smith arrived.", zh: "史密斯醫師到了。", key: 1 },
    { en: "He said hi.", zh: "他打了招呼。", key: 2 },
    { en: "Then he left.", zh: "", key: 3 },
  ];

  it("joins English with a space and Chinese directly", () => {
    expect(joinText("Hi.", " Bye.")).toBe("Hi. Bye.");
    expect(joinText("你好。", "再見。")).toBe("你好。再見。");
    expect(joinText("", "Bye.")).toBe("Bye.");
  });

  it("merges a row with the next one", () => {
    expect(mergeWithNext(rows, 0)).toEqual([
      {
        en: "Dr. Smith arrived. He said hi.",
        zh: "史密斯醫師到了。他打了招呼。",
        key: 1,
      },
      rows[2],
    ]);
    // The last row has nothing to merge with.
    expect(mergeWithNext(rows, 2)).toEqual(rows);
  });

  it("splits a row's English at the cursor", () => {
    const at = rows[0].en.indexOf("arrived");
    expect(splitRowAt(rows, 0, at, (en) => ({ en, zh: "", key: 9 }))).toEqual([
      { en: "Dr. Smith", zh: "史密斯醫師到了。", key: 1 },
      { en: "arrived.", zh: "", key: 9 },
      rows[1],
      rows[2],
    ]);
  });

  it("won't split at an edge, leaving an empty sentence", () => {
    expect(canSplitAt("Hi there.", 0)).toBe(false);
    expect(canSplitAt("Hi there.", 9)).toBe(false);
    expect(canSplitAt("Hi there.", 8)).toBe(false); // only "." after
    expect(canSplitAt("Hi there.", 3)).toBe(true);
    expect(splitRowAt(rows, 1, 0, (en) => ({ en, zh: "", key: 9 }))).toEqual(
      rows,
    );
  });
});
