import { describe, expect, it, vi } from "vitest";
import {
  generateAllNotes,
  prepareDraft,
  prepareForPractice,
  stagePercent,
  type Stage,
} from "@/components/practice-generation";
import { TRANSLATE_BATCH } from "@/lib/custom-practice/notes";
import { NEWS_SENTENCES, NEWS_TEXT } from "./news-text";

describe("stagePercent", () => {
  it.each<[Stage, number]>([
    [{ stage: "split" }, 0],
    [{ stage: "translate", done: 3, total: 6 }, 50],
    [{ stage: "translate", done: 0, total: 0 }, 100],
    // Making a practice ready: notes are the first half, audio the second.
    [{ stage: "notes", done: 0, total: 10 }, 0],
    [{ stage: "notes", done: 10, total: 10 }, 50],
    [{ stage: "audio", done: 4, total: 10 }, 70],
    [{ stage: "audio", done: 10, total: 10 }, 100],
  ])("%j is %i%", (stage, percent) => {
    expect(stagePercent(stage)).toBe(percent);
  });
});

describe("prepareDraft when the server can't be reached (D49)", () => {
  const translate = vi.fn(async (batch: string[]) => ({
    ok: true as const,
    translations: batch.map((line) => `[zh] ${line}`),
  }));

  it("splits the news text by the rules in the browser", async () => {
    const split = vi
      .fn()
      .mockRejectedValue(new Error("Server Action not found"));
    const result = await prepareDraft(
      { split, translate },
      NEWS_TEXT,
      "en",
      () => {},
    );
    expect(result).toEqual({
      ok: true,
      sentences: NEWS_SENTENCES.map((en) => ({ en, zh: `[zh] ${en}` })),
    });
  });

  it("still says when there's nothing to practice", async () => {
    const split = vi.fn().mockRejectedValue(new Error("offline"));
    expect(
      await prepareDraft({ split, translate }, " \n\n ", "en", () => {}),
    ).toEqual({ ok: false, reason: "empty" });
  });

  it("tells a lost connection apart from an empty text", async () => {
    const split = vi.fn(async () => ({
      ok: true as const,
      sentences: NEWS_SENTENCES,
    }));
    const offline = vi.fn().mockRejectedValue(new Error("fetch failed"));
    expect(
      await prepareDraft(
        { split, translate: offline },
        NEWS_TEXT,
        "en",
        () => {},
      ),
    ).toEqual({ ok: false, reason: "network" });
  });
});

describe("prepareDraft", () => {
  const sentences = Array.from(
    { length: TRANSLATE_BATCH + 2 },
    (_, i) => `Line ${i}.`,
  );
  const split = vi.fn(async () => ({ ok: true as const, sentences }));
  const translate = vi.fn(async (batch: string[]) => ({
    ok: true as const,
    translations: batch.map((line) => `[zh] ${line}`),
  }));

  it("splits, then translates batch by batch, reporting finished work", async () => {
    const stages: Stage[] = [];
    const result = await prepareDraft(
      { split, translate },
      "text",
      "en",
      (stage) => stages.push(stage),
    );
    expect(translate).toHaveBeenCalledTimes(2);
    expect(stages).toEqual([
      { stage: "split" },
      { stage: "translate", done: 0, total: TRANSLATE_BATCH + 2 },
      { stage: "translate", done: TRANSLATE_BATCH, total: TRANSLATE_BATCH + 2 },
      {
        stage: "translate",
        done: TRANSLATE_BATCH + 2,
        total: TRANSLATE_BATCH + 2,
      },
    ]);
    expect(result.ok && result.sentences.at(-1)).toEqual({
      en: `Line ${TRANSLATE_BATCH + 1}.`,
      zh: `[zh] Line ${TRANSLATE_BATCH + 1}.`,
    });
  });

  it("keeps Chinese as the handout side when the original is Chinese", async () => {
    const result = await prepareDraft(
      {
        split: async () => ({ ok: true, sentences: ["你好。"] }),
        translate: async () => ({ ok: true, translations: ["Hello."] }),
      },
      "你好。",
      "zh",
      () => {},
    );
    expect(result).toEqual({
      ok: true,
      sentences: [{ en: "Hello.", zh: "你好。" }],
    });
  });

  it("stops at the first failure", async () => {
    const failing = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        translations: sentences.slice(0, TRANSLATE_BATCH),
      })
      .mockResolvedValueOnce({ ok: false, reason: "limit" });
    expect(
      await prepareDraft({ split, translate: failing }, "t", "en", () => {}),
    ).toEqual({ ok: false, reason: "limit" });

    expect(
      await prepareDraft(
        {
          split: async () => ({ ok: false, reason: "too-many" }),
          translate,
        },
        "t",
        "en",
        () => {},
      ),
    ).toEqual({ ok: false, reason: "too-many" });
  });
});

describe("generateAllNotes", () => {
  it("calls chunk after chunk until every sentence has notes", async () => {
    const generateNotes = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, annotated: 10, total: 15 })
      .mockResolvedValueOnce({ ok: true, annotated: 15, total: 15 });
    const progress: number[] = [];
    expect(
      await generateAllNotes(generateNotes, "p1", (done) =>
        progress.push(done),
      ),
    ).toEqual({ ok: true, annotated: 15, total: 15 });
    expect(progress).toEqual([10, 15]);
  });

  it("stops when a chunk makes no progress", async () => {
    const stuck = vi
      .fn()
      .mockResolvedValue({ ok: true, annotated: 10, total: 15 });
    expect(await generateAllNotes(stuck, "p1", () => {})).toEqual({
      ok: false,
      reason: "failed",
    });
    expect(stuck).toHaveBeenCalledTimes(2);
  });
});

describe("prepareForPractice", () => {
  it("reports notes, then audio, starting before the first batch returns", async () => {
    const stages: Stage[] = [];
    const result = await prepareForPractice(
      {
        generateNotes: async () => ({ ok: true, annotated: 4, total: 4 }),
        generate: async () => ({ ok: true, voiced: 4, total: 4 }),
      },
      { id: "p1", notesReady: false, total: 4 },
      (stage) => stages.push(stage),
    );
    expect(result).toEqual({ ok: true });
    expect(stages).toEqual([
      { stage: "notes", done: 0, total: 4 },
      { stage: "notes", done: 4, total: 4 },
      { stage: "audio", done: 4, total: 4 },
    ]);
  });
});
