import { describe, expect, it } from "vitest";
import { normalizeWords } from "@/lib/scoring/normalize";

describe("normalizeWords", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizeWords('Hello, World! "Really?"')).toEqual([
      "hello",
      "world",
      "really",
    ]);
  });

  it("collapses extra whitespace", () => {
    expect(normalizeWords("  a \n b\t c  ")).toEqual(["a", "b", "c"]);
    expect(normalizeWords("")).toEqual([]);
    expect(normalizeWords("  ... !! ")).toEqual([]);
  });

  it.each([
    ["Don't go", ["do", "not", "go"]],
    ["I'm here", ["i", "am", "here"]],
    ["It's late", ["it", "is", "late"]],
    ["We can't", ["we", "can", "not"]],
    ["We cannot", ["we", "can", "not"]],
    ["They won't", ["they", "will", "not"]],
    ["Let's eat", ["let", "us", "eat"]],
  ])("expands contractions: %s", (input, expected) => {
    expect(normalizeWords(input)).toEqual(expected);
  });

  it("treats curly apostrophes like straight ones", () => {
    expect(normalizeWords("Don’t")).toEqual(["do", "not"]);
  });

  it("keeps ambiguous contractions and possessives as single words", () => {
    expect(normalizeWords("Anna's book")).toEqual(["anna's", "book"]);
    expect(normalizeWords("I'd go")).toEqual(["i'd", "go"]);
  });

  it("drops quote marks around words", () => {
    expect(normalizeWords("'hello' 'cause")).toEqual(["hello", "cause"]);
  });

  it("splits hyphenated words", () => {
    expect(normalizeWords("a well-known fact")).toEqual([
      "a",
      "well",
      "known",
      "fact",
    ]);
  });

  it.each([
    ["0", ["0"]],
    ["5", ["5"]],
    ["five", ["5"]],
    ["13", ["13"]],
    ["twenty-one", ["21"]],
    ["ninety nine", ["99"]],
  ])("reads a number as one token: %s (D126)", (input, expected) => {
    expect(normalizeWords(input)).toEqual(expected);
  });

  it("reads % as percent, so digits and words match either way", () => {
    const words = ["memory", "overwrite", "90", "percent"];
    expect(normalizeWords("Memory overwrite, 90%.")).toEqual(words);
    expect(normalizeWords("memory overwrite 90 percent")).toEqual(words);
    expect(normalizeWords("Memory overwrite, ninety percent")).toEqual(words);
    expect(normalizeWords("ninety %")).toEqual(["90", "percent"]);
  });

  it("keeps sentence punctuation off numbers", () => {
    expect(normalizeWords("It costs 5.")).toEqual(["it", "costs", "5"]);
    expect(normalizeWords("in 2026")).toEqual(["in", "2026"]);
    expect(normalizeWords("1, 2, 3")).toEqual(["1", "2", "3"]);
  });

  it("keeps accented letters", () => {
    expect(normalizeWords("Café")).toEqual(["café"]);
  });
});
