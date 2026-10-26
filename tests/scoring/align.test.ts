import { describe, expect, it } from "vitest";
import { alignWords, countMatches } from "@/lib/scoring/align";

const words = (text: string) => (text ? text.split(" ") : []);

describe("alignWords", () => {
  it("matches identical sentences word for word", () => {
    const ops = alignWords(words("we moved here"), words("we moved here"));
    expect(ops.map((op) => op.type)).toEqual(["match", "match", "match"]);
    expect(countMatches(ops)).toBe(3);
  });

  it("marks a wrong word as a substitution", () => {
    expect(alignWords(words("we moved here"), words("we move here"))).toEqual([
      { type: "match", ref: "we", hyp: "we" },
      { type: "substitute", ref: "moved", hyp: "move" },
      { type: "match", ref: "here", hyp: "here" },
    ]);
  });

  it("marks a missing word as a deletion", () => {
    expect(
      alignWords(words("it took a while"), words("it took while")),
    ).toEqual([
      { type: "match", ref: "it", hyp: "it" },
      { type: "match", ref: "took", hyp: "took" },
      { type: "delete", ref: "a" },
      { type: "match", ref: "while", hyp: "while" },
    ]);
  });

  it("marks an extra word as an insertion", () => {
    expect(alignWords(words("go home"), words("go to home"))).toEqual([
      { type: "match", ref: "go", hyp: "go" },
      { type: "insert", hyp: "to" },
      { type: "match", ref: "home", hyp: "home" },
    ]);
  });

  it("handles empty inputs", () => {
    expect(alignWords([], [])).toEqual([]);
    expect(alignWords(words("a b"), [])).toEqual([
      { type: "delete", ref: "a" },
      { type: "delete", ref: "b" },
    ]);
    expect(alignWords([], words("a"))).toEqual([{ type: "insert", hyp: "a" }]);
  });

  it("keeps every reference word exactly once, in order", () => {
    const ref = words("the quick brown fox jumps over the lazy dog");
    const hyp = words("a quick fox jumped over the the lazy dogs today");
    const refWords = alignWords(ref, hyp).flatMap((op) =>
      op.type === "insert" ? [] : [op.ref],
    );
    expect(refWords).toEqual(ref);
  });

  it("credits every in-order correct word, even when substitutions tie", () => {
    // Two 2-edit alignments exist; the fair one keeps "like" as a match.
    const ops = alignWords(
      words("i like green tea"),
      words("i really like tea"),
    );
    expect(countMatches(ops)).toBe(3);
    expect(ops.filter((op) => op.type !== "match")).toHaveLength(2);
  });

  it("maximizes matches even when that needs more edits", () => {
    // Shifting by one word: 3 matches (+1 extra, +1 missing) beats 4 substitutions.
    const ops = alignWords(words("a b c d"), words("x a b c"));
    expect(countMatches(ops)).toBe(3);
  });

  it("always finds as many matches as the longest common subsequence", () => {
    // Independent reference implementation to cross-check alignWords.
    function lcsLength(a: string[], b: string[]): number {
      const dp = Array.from({ length: a.length + 1 }, () =>
        new Array<number>(b.length + 1).fill(0),
      );
      for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
          dp[i][j] =
            a[i - 1] === b[j - 1]
              ? dp[i - 1][j - 1] + 1
              : Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
      return dp[a.length][b.length];
    }

    // Small deterministic PRNG so failures are reproducible.
    let seed = 42;
    const random = () =>
      (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    const vocab = ["a", "b", "c", "d", "e"];
    const sentence = () =>
      Array.from(
        { length: Math.floor(random() * 8) },
        () => vocab[Math.floor(random() * vocab.length)],
      );

    for (let run = 0; run < 500; run++) {
      const ref = sentence();
      const hyp = sentence();
      const ops = alignWords(ref, hyp);
      expect(countMatches(ops), `${ref} | ${hyp}`).toBe(lcsLength(ref, hyp));
      // Ops must replay both sentences exactly.
      expect(ops.flatMap((op) => ("ref" in op ? [op.ref] : []))).toEqual(ref);
      expect(ops.flatMap((op) => ("hyp" in op ? [op.hyp] : []))).toEqual(hyp);
    }
  });

  it("prefers a substitution over missing + extra when matches tie", () => {
    expect(alignWords(words("a b c"), words("a x c"))).toEqual([
      { type: "match", ref: "a", hyp: "a" },
      { type: "substitute", ref: "b", hyp: "x" },
      { type: "match", ref: "c", hyp: "c" },
    ]);
  });
});
