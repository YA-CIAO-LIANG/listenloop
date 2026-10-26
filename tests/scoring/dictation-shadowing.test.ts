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

  it("scores matched words / reference words", () => {
    // 6 of 7 reference words right ("move" ≠ "moved").
    const result = scoreDictation(
      "We moved to the city last year.",
      "We move to the city last year",
    );
    expect(result.correct).toBe(6);
    expect(result.total).toBe(7);
    expect(result.accuracy).toBeCloseTo(6 / 7);
  });

  it("doesn't reward extra words", () => {
    const result = scoreDictation("Go home.", "go to home now");
    expect(result).toMatchObject({ correct: 2, total: 2, accuracy: 1 });
    expect(result.ops.filter((op) => op.type === "insert")).toHaveLength(2);
  });

  it("gives 0 for an empty answer", () => {
    expect(scoreDictation("Go home.", "   ").accuracy).toBe(0);
  });
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
