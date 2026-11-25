import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseRichNotes } from "@/lib/custom-practice/rich-notes";
import { writtenProblems } from "@/lib/official-written";

/**
 * Every hand-written official material (D213) passes the same checks as
 * a batch-made one before its voice is made, its notes come through the
 * cleaner untouched, and slugs and titles are unique.
 */
const DIR = "data/official";
const files = readdirSync(DIR).filter((f) => f.endsWith(".json"));
const materials = files.map((f) => ({
  f,
  m: JSON.parse(readFileSync(`${DIR}/${f}`, "utf8")),
}));

describe("data/official (D213)", () => {
  it.each(materials)("$f passes the official checks", ({ f, m }) => {
    expect(writtenProblems(m)).toEqual([]);
    expect(`${m.slug}.json`).toBe(f);
  });

  it.each(materials)("$f keeps every note through the cleaner", ({ m }) => {
    for (const s of m.sentences) {
      const cleaned = parseRichNotes(s.notes, s.en)!;
      for (const key of [
        "highlights",
        "vocab",
        "grammar",
        "chunks",
        "connected",
      ] as const) {
        expect(cleaned[key].length, `${s.en} ${key}`).toBe(s.notes[key].length);
      }
    }
  });

  it("has unique titles", () => {
    const titles = materials.map(({ m }) => m.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("rejects a material without a source in the classics", () => {
    const { m } = materials.find(({ m }) => m.series === "classics")!;
    expect(writtenProblems({ ...m, source: { kind: "original" } })).toContain(
      "classics need a source",
    );
  });
});
