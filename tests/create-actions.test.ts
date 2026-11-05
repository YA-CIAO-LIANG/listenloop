import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSpeech, fakeLanguage } from "@/lib/ai/fake";
import { TRANSLATE_BATCH } from "@/lib/custom-practice/notes";

type Insert = { table: string; rows: unknown };
const state = vi.hoisted(() => ({
  creator: true,
  reserve: vi.fn(),
  inserts: [] as Insert[],
  deletes: [] as string[],
  failSentences: false,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/auth/creator", () => ({
  getCreator: async () =>
    state.creator
      ? {
          user: { id: "user-1", email: "joe@example.com" },
          providers: { language: fakeLanguage, speech: fakeSpeech },
          meter: { reserve: state.reserve },
          cache: { get: async () => null, set: async () => {} },
        }
      : null,
}));
vi.mock("@/auth/server", () => ({
  getServerSupabase: async () => ({
    from: (table: string) => ({
      insert: (rows: unknown) => {
        state.inserts.push({ table, rows });
        const result =
          table === "practice_sentences" && state.failSentences
            ? { error: { message: "nope" } }
            : { error: null };
        return {
          ...result,
          select: () => ({
            single: async () => ({ data: { id: "p1" }, error: null }),
          }),
        };
      },
      delete: () => ({
        eq: async (_: string, id: string) => {
          state.deletes.push(id);
          return { error: null };
        },
      }),
    }),
  }),
}));

const { createPractice, splitText, translateSentences } =
  await import("@/app/materials/actions");

beforeEach(() => {
  state.creator = true;
  state.reserve.mockReset().mockResolvedValue(true);
  state.inserts = [];
  state.deletes = [];
  state.failSentences = false;
});

describe("splitText", () => {
  it("splits by meaning, counting the model call", async () => {
    expect(await splitText("你好。再見。", "zh")).toEqual({
      ok: true,
      sentences: ["你好。", "再見。"],
    });
    expect(state.reserve).toHaveBeenCalledWith("translation", 6);
  });

  it("still splits, by the rules, when the model can't be used", async () => {
    state.reserve.mockResolvedValue(false);
    expect(await splitText("Hi there. Bye now.", "en")).toEqual({
      ok: true,
      sentences: ["Hi there.", "Bye now."],
    });
  });

  it.each([
    ["nothing to practice", "  ---  ", "en", "empty"],
    ["a bad language", "Hi.", "fr", "empty"],
    ["text over the limit", "a".repeat(10_001), "en", "too-long"],
    ["too many sentences", "A.\n".repeat(301), "en", "too-many"],
  ])("refuses %s", async (_, text, language, reason) => {
    expect(await splitText(text, language)).toEqual({ ok: false, reason });
  });

  it("is unavailable to non-admins", async () => {
    state.creator = false;
    expect(await splitText("Hi.", "en")).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });
});

describe("translateSentences", () => {
  it("translates Chinese into the English to practice", async () => {
    expect(await translateSentences(["你好。", "再見。"], "zh")).toEqual({
      ok: true,
      translations: ["[en] 你好。", "[en] 再見。"],
    });
    expect(state.reserve).toHaveBeenCalledWith("translation", 6);
  });

  it("translates English into Chinese for the handout", async () => {
    expect(await translateSentences(["Hi.", "Bye."], "en")).toEqual({
      ok: true,
      translations: ["[zh-Hant] Hi.", "[zh-Hant] Bye."],
    });
  });

  it.each([
    ["no sentences", [], "en"],
    ["more than a batch", Array(TRANSLATE_BATCH + 1).fill("Hi."), "en"],
    ["an empty sentence", ["Hi.", " "], "en"],
    ["a non-string", ["Hi.", 3], "en"],
    ["a bad language", ["Hi."], "fr"],
  ])("refuses %s without spending", async (_, sentences, language) => {
    expect(await translateSentences(sentences, language)).toEqual({
      ok: false,
      reason: "empty",
    });
    expect(state.reserve).not.toHaveBeenCalled();
  });

  it("passes on the daily limit", async () => {
    state.reserve.mockResolvedValue(false);
    expect(await translateSentences(["Hi."], "en")).toEqual({
      ok: false,
      reason: "limit",
    });
  });

  it("is unavailable to non-admins", async () => {
    state.creator = false;
    expect(await translateSentences(["Hi."], "en")).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });
});

describe("createPractice", () => {
  const draft = {
    title: " Moving ",
    sourceLanguage: "en",
    voice: "gb-male",
    sentences: [
      { en: "We moved.", zh: "我們搬家了。" },
      { en: "Nice.", zh: "" },
    ],
  };

  it("saves the practice, then its sentences in order", async () => {
    expect(await createPractice(draft)).toEqual({ ok: true, id: "p1" });
    expect(state.inserts).toEqual([
      {
        table: "practices",
        rows: {
          user_id: "user-1",
          title: "Moving",
          source_language: "en",
          voice: "gb-male",
        },
      },
      {
        table: "practice_sentences",
        rows: [
          { practice_id: "p1", i: 0, en: "We moved.", zh: "我們搬家了。" },
          // Chinese left empty in review is translated on save.
          { practice_id: "p1", i: 1, en: "Nice.", zh: "[zh-Hant] Nice." },
        ],
      },
    ]);
  });

  it("saves nothing when the missing Chinese can't be translated", async () => {
    state.reserve.mockResolvedValue(false);
    expect(await createPractice(draft)).toEqual({ ok: false, reason: "limit" });
    expect(state.inserts).toEqual([]);
  });

  it("removes the practice when its sentences can't be saved", async () => {
    state.failSentences = true;
    expect(await createPractice(draft)).toEqual({
      ok: false,
      reason: "failed",
    });
    expect(state.deletes).toEqual(["p1"]);
  });

  it("rejects an invalid draft before writing anything", async () => {
    expect(
      await createPractice({ ...draft, sentences: [{ en: "", zh: "" }] }),
    ).toEqual({
      ok: false,
      reason: "invalid",
      problem: "sentence-empty",
      sentence: 0,
    });
    expect(state.inserts).toEqual([]);
  });

  it("is unavailable to non-admins", async () => {
    state.creator = false;
    expect(await createPractice(draft)).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });
});
