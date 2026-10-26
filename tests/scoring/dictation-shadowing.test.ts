import { describe, expect, it } from "vitest";
import { scoreDictation, totalAccuracy } from "@/lib/scoring/dictation";
import { COVERAGE_THRESHOLD, scoreShadowing } from "@/lib/scoring/shadowing";

describe("scoreDictation", () => {
  it("gives 100% for a perfect answer, ignoring case and punctuation", () => {
    const result = scoreDictation(
      "We moved to the city last year.",
      "we moved to the city last year",
    );
    expect(result).toMatchObject({ correct: 7, total: 7, accuracy: 1 });
  });

  it("treats contractions and their expansions as the same", () => {
    expect(scoreDictation("I don't know.", "I do not know").accuracy).toBe(1);
    expect(scoreDictation("I do not know.", "I don't know").accuracy).toBe(1);
  });

  it("scores correct / max(reference words, answer words)", () => {
    // 6 of 7 right ("move" ≠ "moved"); same length, so 6/7.
    const result = scoreDictation(
      "We moved to the city last year.",
      "We move to the city last year",
    );
    expect(result).toMatchObject({
      correct: 6,
      referenceWords: 7,
      answerWords: 7,
      total: 7,
    });
    expect(result.accuracy).toBeCloseTo(6 / 7);
  });

  it("still gives 3/4 for 'i really like tea' vs 'i like green tea'", () => {
    const result = scoreDictation("I like green tea.", "i really like tea");
    expect(result).toMatchObject({ correct: 3, total: 4, accuracy: 3 / 4 });
  });

  it("divides by the reference length when the answer is shorter", () => {
    const result = scoreDictation(
      "We moved to the city last year.",
      "we moved",
    );
    expect(result).toMatchObject({ correct: 2, total: 7 });
  });

  it("penalizes extra words", () => {
    // 2 correct, but 4 words typed → 2/4.
    const result = scoreDictation("Go home.", "go to home now");
    expect(result).toMatchObject({ correct: 2, total: 4, accuracy: 0.5 });
  });

  it("drops sharply when the answer is padded with common words", () => {
    const reference = "We moved to the city last year.";
    // Every reference word appears in order, buried in filler.
    const padded =
      "we the a moved to of the and city is last it year in on you that";
    const result = scoreDictation(reference, padded);
    expect(result.correct).toBe(7); // would have been 100% before
    expect(result.accuracy).toBeCloseTo(7 / 17);
    expect(result.accuracy).toBeLessThan(0.5);

    // A long spray of common words can't reach the 80% pass mark either.
    const spray = Array.from({ length: 5 }, () => padded).join(" ");
    expect(scoreDictation(reference, spray).accuracy).toBeLessThan(0.1);
  });

  it.each(["", "   ", "...!?"])(
    "gives 0 for an empty answer (%j)",
    (answer) => {
      const result = scoreDictation("Go home.", answer);
      expect(result).toMatchObject({ correct: 0, answerWords: 0, accuracy: 0 });
    },
  );
});

describe("totalAccuracy", () => {
  it("weights by word count, not by sentence", () => {
    // 1/3 and 15/15 → 16/18, not the average of 33% and 100%.
    expect(
      totalAccuracy([
        { correct: 1, total: 3 },
        { correct: 15, total: 15 },
      ]),
    ).toBeCloseTo(16 / 18);
  });

  it("counts padded answers against the day", () => {
    const day = [
      scoreDictation("Go home.", "go home"), // 2/2
      scoreDictation("Go home.", "go to my home now please"), // 2/6
    ];
    expect(totalAccuracy(day)).toBeCloseTo(4 / 8);
  });

  it("is 1 with nothing to score", () => {
    expect(totalAccuracy([])).toBe(1);
  });
});

describe("scoreShadowing", () => {
  it("is complete when every word is heard", () => {
    const result = scoreShadowing(
      "It took a while to settle in.",
      "it took a while to settle in",
    );
    expect(result).toMatchObject({
      coverage: 1,
      complete: true,
      missedIndexes: [],
    });
  });

  it("matches recognized digits to spelled-out numbers", () => {
    expect(scoreShadowing("I have five cats.", "I have 5 cats").coverage).toBe(
      1,
    );
  });

  it("reports the positions of missed words", () => {
    // "it took a while to settle in" → missed "a" (2) and "in" (6).
    const result = scoreShadowing(
      "It took a while to settle in.",
      "it took while to settle",
    );
    expect(result.missedIndexes).toEqual([2, 6]);
    expect(result.coverage).toBeCloseTo(5 / 7);
  });

  it("uses a 70% threshold, inclusive", () => {
    expect(COVERAGE_THRESHOLD).toBe(0.7);
    // 7 of 10 words → exactly 70%.
    const ref = "one two three four five six seven eight nine ten";
    expect(
      scoreShadowing(ref, "one two three four five six seven").complete,
    ).toBe(true);
    expect(scoreShadowing(ref, "one two three four five six").complete).toBe(
      false,
    );
  });

  it("ignores extra recognized words", () => {
    const result = scoreShadowing("Go home.", "um go go home please");
    expect(result.coverage).toBe(1);
  });
});
