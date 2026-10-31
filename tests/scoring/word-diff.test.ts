import { describe, expect, it } from "vitest";
import { wordDiff } from "@/lib/scoring/word-diff";

/** Compact view: wrong/missed words in [brackets]. */
const show = (words: { text: string; ok: boolean }[]) =>
  words.map((w) => (w.ok ? w.text : `[${w.text}]`)).join(" ");

describe("wordDiff", () => {
  it("marks nothing when the answer is right, keeping original spelling", () => {
    const diff = wordDiff(
      "We moved to the city last year.",
      "we moved to the city last year",
    );
    expect(show(diff.reference)).toBe("We moved to the city last year.");
    expect(show(diff.answer)).toBe("we moved to the city last year");
  });

  it("matches 90% to ninety percent but shows each as written", () => {
    const diff = wordDiff(
      "Memory overwrite, 90%.",
      "memory overwrite ninety percent",
    );
    expect(show(diff.reference)).toBe("Memory overwrite, 90%.");
    expect(show(diff.answer)).toBe("memory overwrite ninety percent");
    expect(
      show(wordDiff("Memory overwrite, 90%.", "memory overwrite 90").reference),
    ).toBe("Memory overwrite, [90%.]");
  });

  it("marks a wrong word on both lines", () => {
    const diff = wordDiff("We moved to the city.", "We move to the city.");
    expect(show(diff.answer)).toBe("We [move] to the city.");
    expect(show(diff.reference)).toBe("We [moved] to the city.");
  });

  it("marks extra words on the answer line only", () => {
    const diff = wordDiff("We moved to the city.", "We moved to the big city.");
    expect(show(diff.answer)).toBe("We moved to the [big] city.");
    expect(show(diff.reference)).toBe("We moved to the city.");
  });

  it("marks missed words on the reference line only", () => {
    const diff = wordDiff("It took a while.", "It took while.");
    expect(show(diff.answer)).toBe("It took while.");
    expect(show(diff.reference)).toBe("It took [a] while.");
  });

  it("treats a contraction and its expansion as the same words", () => {
    const diff = wordDiff("You're lucky.", "you are lucky");
    expect(show(diff.answer)).toBe("you are lucky");
    expect(show(diff.reference)).toBe("You're lucky.");
  });

  it("marks a contraction wrong if any of its parts is wrong", () => {
    // "don't" = "do not"; the user wrote "do now".
    const diff = wordDiff("I don't know.", "I do now know");
    expect(show(diff.reference)).toBe("I [don't] know.");
    expect(show(diff.answer)).toBe("I do [now] know");
  });

  it("matches digits to spelled-out numbers", () => {
    const diff = wordDiff("I have five cats.", "I have 5 cats");
    expect(show(diff.reference)).toBe("I have five cats.");
    expect(show(diff.answer)).toBe("I have 5 cats");
  });

  it("keeps punctuation-only pieces and never marks them", () => {
    const diff = wordDiff("So... wait — what?", "so wait what");
    expect(show(diff.reference)).toBe("So... wait — what?");
  });

  it("handles an empty answer", () => {
    const diff = wordDiff("Go home.", "");
    expect(diff.answer).toEqual([]);
    expect(show(diff.reference)).toBe("[Go] [home.]");
  });
});
