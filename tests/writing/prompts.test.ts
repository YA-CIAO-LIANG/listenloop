import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { allWritingPrompts, writingPrompts } from "@/data/writing";
import { WRITING_TYPES } from "@/lib/writing/types";
import { writingPromptProblems } from "@/lib/writing/validate";

const folder = join(__dirname, "../../data/writing/prompts");

describe("official writing prompts (D187)", () => {
  it("lists every JSON file, once", () => {
    const files = readdirSync(folder)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""))
      .sort();
    expect(allWritingPrompts.map((p) => p.id).sort()).toEqual(files);
    expect(new Set(files).size).toBe(files.length);
  });

  it("passes the automatic check", () => {
    for (const prompt of writingPrompts) {
      expect([prompt.id, writingPromptProblems(prompt)]).toEqual([
        prompt.id,
        [],
      ]);
    }
  });

  it("catches a broken prompt", () => {
    const broken = {
      ...writingPrompts[0],
      patterns: [],
      words: { min: 10, max: 5 },
    };
    expect(writingPromptProblems(broken)).toEqual(
      expect.arrayContaining(["words", "patterns (3–5)"]),
    );
  });

  it("only names kinds that exist", () => {
    for (const prompt of allWritingPrompts) {
      expect(WRITING_TYPES).toContain(prompt.type);
    }
  });
});
