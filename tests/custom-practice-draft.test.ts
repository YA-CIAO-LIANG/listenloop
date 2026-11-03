import { describe, expect, it } from "vitest";
import {
  cleanDraft,
  PRACTICE_LIMITS,
  titleFromFileName,
} from "@/lib/custom-practice/draft";

const sentence = { en: "Hello there.", zh: "你好。" };
const draft = { title: "My text", sourceLanguage: "en", sentences: [sentence] };

describe("cleanDraft", () => {
  it("accepts a draft and tidies whitespace", () => {
    expect(
      cleanDraft({
        title: "  My   text ",
        sourceLanguage: "zh",
        sentences: [{ en: " Hello\n there. ", zh: " 你好。 " }],
      }),
    ).toEqual({
      ok: true,
      draft: { title: "My text", sourceLanguage: "zh", sentences: [sentence] },
    });
  });

  it.each([
    ["no title", { ...draft, title: "  " }, "title"],
    ["a long title", { ...draft, title: "x".repeat(101) }, "title"],
    ["no sentences", { ...draft, sentences: [] }, "no-sentences"],
    ["a bad language", { ...draft, sourceLanguage: "fr" }, "no-sentences"],
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
