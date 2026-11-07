import { describe, expect, it } from "vitest";
import {
  markQuote,
  markSentence,
  missedPieces,
  missedWords,
  piecesIn,
  touchesMissed,
} from "@/lib/custom-practice/marks";

/** Highlighter positions (D66, D68). */
const EN =
  "If you're going to the library later, could you pick up the book I reserved?";

describe("missed words", () => {
  it("are the sentence words the answer got wrong or left out", () => {
    const missed = missedPieces(
      EN,
      "if your going to the library later could you pick the book I reserve",
    );
    expect(missedWords(EN, missed)).toEqual(["you're", "up", "reserved"]);
  });
});

describe("quotes", () => {
  it("find their words in the sentence, whatever the case or quote marks", () => {
    expect(piecesIn(EN, "Pick up")).toEqual([9, 10]);
    expect(piecesIn("Don’t stop.", "don't")).toEqual([0]);
    expect(piecesIn(EN, "not here")).toEqual([]);
  });

  it("tell whether they touch a mistake", () => {
    const missed = new Set([10]);
    expect(touchesMissed(EN, "pick up", missed)).toBe(true);
    expect(touchesMissed(EN, "the library", missed)).toBe(false);
  });
});

describe("markSentence", () => {
  it("marks mistakes over key words, and joins runs", () => {
    expect(
      markSentence("I want to pick it up.", new Set([2]), [
        "want to",
        "pick it up",
      ]),
    ).toEqual([
      { text: "I ", mark: null },
      { text: "want", mark: "key" },
      { text: " ", mark: null },
      { text: "to", mark: "miss" },
      { text: " ", mark: null },
      { text: "pick it up.", mark: "key" },
    ]);
  });
});

describe("markQuote", () => {
  it("marks the missed words inside a chunk", () => {
    expect(markQuote(EN, "could you pick up the book", new Set([10]))).toEqual([
      { text: "could you pick ", mark: null },
      { text: "up", mark: "miss" },
      { text: " the book", mark: null },
    ]);
    expect(markQuote(EN, "the library later,", new Set([10]))).toEqual([
      { text: "the library later,", mark: null },
    ]);
  });
});
