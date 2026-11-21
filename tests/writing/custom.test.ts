import { describe, expect, it } from "vitest";
import { writingPrompts } from "@/data/writing";
import {
  CUSTOM_WORDS,
  customTask,
  customWritingPrompt,
  isCustomPromptId,
  mergeCustomPrompts,
  newCustomId,
  parseCustomPrompts,
  type CustomPrompt,
} from "@/lib/writing/custom";
import { isWritingStorageKey } from "@/lib/writing/store";

/** A learner's own prompts (D196). */
const prompt = (over: Partial<CustomPrompt> = {}): CustomPrompt => ({
  id: "c-1234567890abcdef",
  kind: "custom",
  title: "",
  task: "Write an email to my landlord about the heater.",
  createdAt: "2026-11-21T01:00:00.000Z",
  updatedAt: "2026-11-21T01:00:00.000Z",
  ...over,
});

describe("custom prompt ids", () => {
  it("never look like an official prompt's", () => {
    for (const p of writingPrompts) expect(isCustomPromptId(p.id)).toBe(false);
    const id = newCustomId();
    expect(isCustomPromptId(id)).toBe(true);
    expect(id.length).toBeLessThanOrEqual(40);
  });
});

describe("parsing and merging", () => {
  it("keeps valid prompts, drops the rest, and clips text", () => {
    const parsed = parseCustomPrompts({
      prompts: [
        prompt({ title: "x".repeat(200) }),
        { id: "p-not-custom", kind: "diary", createdAt: "2026-11-21" },
        prompt({ id: "c-abcdefgh1", kind: "diary", task: "ignored" }),
      ],
    });
    expect(parsed).toHaveLength(2);
    expect(parsed[0].title).toHaveLength(80);
    expect(parsed[1].task).toBe("");
  });

  it("keeps the later change of each prompt, deletions included", () => {
    const old = prompt();
    const deleted = prompt({
      deleted: true,
      updatedAt: "2026-11-21T02:00:00.000Z",
    });
    const other = prompt({
      id: "c-otherprompt1",
      createdAt: "2026-11-22T00:00:00.000Z",
    });
    const merged = mergeCustomPrompts([old, other], [deleted]);
    expect(merged.map((p) => p.id)).toEqual(["c-otherprompt1", old.id]);
    expect(merged[1].deleted).toBe(true);
  });

  it("is cleared with the rest of the writing data on sign-out", () => {
    expect(isWritingStorageKey("ll-writing-custom:v1")).toBe(true);
  });
});

describe("as a writing prompt", () => {
  it("has no model essay, the general rubric's kind, and the kind's length", () => {
    const diary = customWritingPrompt(
      prompt({ kind: "diary", task: "" }),
      { en: "Diary", zh: "日記" },
      "寫日記",
    );
    expect(diary).toMatchObject({
      type: "daily",
      custom: "diary",
      words: CUSTOM_WORDS.diary,
      model: { en: [], zh: [] },
      patterns: [],
    });
    expect(diary.task).toBe(customTask({ kind: "diary", task: "" }));
    expect(customTask(prompt())).toBe(prompt().task);
  });
});
