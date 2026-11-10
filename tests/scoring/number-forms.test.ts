import { describe, expect, it } from "vitest";
import { scoreDictation } from "@/lib/scoring/dictation";
import { normalizeTokens, normalizeWords } from "@/lib/scoring/normalize";
import { scoreShadowing } from "@/lib/scoring/shadowing";
import { wordDiff } from "@/lib/scoring/word-diff";

/**
 * Every way of writing a number counts as the same (D126), in dictation,
 * shadowing, and the highlighted feedback.
 */
const SAME: [string, string[]][] = [
  ["600", ["six hundred", "6 hundred"]],
  ["6 million", ["6,000,000", "six million", "6000000", "6 Million"]],
  ["1.5", ["one point five"]],
  ["2.75 million", ["two point seven five million", "2,750,000"]],
  ["1,000", ["1000", "one thousand", "a thousand"]],
  ["3,000", ["three thousand", "3000"]],
  ["4 billion", ["four billion", "4,000,000,000"]],
  ["2 trillion", ["two trillion"]],
  ["one hundred and five", ["105", "one hundred five"]],
  ["2,500", ["two thousand five hundred", "two thousand, five hundred"]],
  ["1st", ["first"]],
  ["2nd", ["second"]],
  ["3rd", ["third"]],
  ["21st", ["twenty-first", "twenty first"]],
  ["100th", ["hundredth", "one hundredth"]],
  ["$5", ["five dollars", "5 dollars"]],
  ["$1", ["one dollar"]],
  ["$3.50", ["three dollars fifty", "3 dollars 50"]],
  ["$5 million", ["five million dollars"]],
  ["90%", ["ninety percent", "90 percent"]],
  ["9:30", ["nine thirty", "9 30"]],
  ["10:30", ["ten thirty"]],
  ["9:05", ["nine oh five"]],
  ["7 a.m.", ["seven am", "7 am", "7am", "Seven A.M.", "7 AM"]],
  ["11 p.m.", ["eleven pm"]],
  [
    "2025",
    [
      "twenty twenty-five",
      "two thousand twenty-five",
      "two thousand and twenty-five",
    ],
  ],
  ["1984", ["nineteen eighty-four"]],
  ["1905", ["nineteen oh five"]],
  ["2000", ["two thousand"]],
];

describe("number forms (D126)", () => {
  it.each(SAME)("%s matches %j", (written, forms) => {
    const reference = `It was ${written} that day.`;
    for (const form of forms) {
      const answer = `It was ${form} that day.`;
      expect(normalizeWords(answer), form).toEqual(normalizeWords(reference));
      // Either side may be the reference.
      expect(scoreDictation(reference, answer).accuracy, form).toBe(1);
      expect(scoreDictation(answer, reference).accuracy, form).toBe(1);
      expect(scoreShadowing(reference, answer).coverage, form).toBe(1);
      // Nothing is marked wrong in the feedback.
      const diff = wordDiff(reference, answer);
      expect(
        [...diff.reference, ...diff.answer].every((w) => w.ok),
        form,
      ).toBe(true);
    }
  });

  it("counts a number as one word, however it's written", () => {
    expect(
      scoreDictation("I have 600 dollars.", "I have six hundred dollars."),
    ).toMatchObject({
      referenceWords: 4,
      answerWords: 4,
      accuracy: 1,
    });
  });

  it("still tells different numbers apart, marking the whole number", () => {
    expect(
      scoreDictation("I have 600 dollars.", "I have six hundred fifty dollars.")
        .accuracy,
    ).toBe(0.75);
    const diff = wordDiff(
      "I have 600 dollars.",
      "I have six hundred fifty dollars.",
    );
    expect(diff.reference.map((w) => w.ok)).toEqual([true, true, false, true]);
    expect(diff.answer.map((w) => w.ok)).toEqual([
      true,
      true,
      false,
      false,
      false,
      true,
    ]);
    expect(normalizeWords("21st")).not.toEqual(normalizeWords("21"));
    expect(normalizeWords("$5")).not.toEqual(normalizeWords("5"));
    expect(normalizeWords("1.5")).not.toEqual(normalizeWords("15"));
  });

  it("reads a time as two numbers, not one", () => {
    // "nine thirty" isn't 39, and "five twenty" isn't 25.
    expect(normalizeWords("nine thirty")).toEqual(["9", "30"]);
    expect(normalizeWords("five twenty")).toEqual(["5", "20"]);
    expect(normalizeWords("twenty five")).toEqual(["25"]);
  });

  it("leaves words that only look like numbers alone", () => {
    expect(normalizeWords("a cat")).toEqual(["a", "cat"]);
    expect(normalizeWords("one of them")).toEqual(["1", "of", "them"]);
    expect(normalizeWords("I am here")).toEqual(["i", "am", "here"]);
    expect(normalizeWords("the 1990s")).toEqual(["the", "1990s"]);
    expect(normalizeWords("point of view")).toEqual(["point", "of", "view"]);
  });

  it("knows which written words each token came from", () => {
    expect(normalizeTokens("about six hundred people")).toEqual({
      words: ["about", "600", "people"],
      owners: [[0], [1, 2], [3]],
    });
    expect(normalizeTokens("$3.50 now")).toEqual({
      words: ["3", "dollars", "50", "now"],
      owners: [[0], [0], [0], [1]],
    });
  });
});
