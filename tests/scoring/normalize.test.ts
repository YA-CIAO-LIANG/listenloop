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
    expect(normalizeWords("twenty-one")).toEqual(["twenty", "one"]);
  });

  it.each([
    ["0", ["zero"]],
    ["5", ["five"]],
    ["13", ["thirteen"]],
    ["20", ["twenty"]],
    ["21", ["twenty", "one"]],
    ["99", ["ninety", "nine"]],
  ])("spells out %s", (input, expected) => {
    expect(normalizeWords(input)).toEqual(expected);
  });

  it("leaves larger numbers as digits", () => {
    expect(normalizeWords("in 2026")).toEqual(["in", "2026"]);
  });

  it("keeps accented letters", () => {
    expect(normalizeWords("Café")).toEqual(["café"]);
  });
});
