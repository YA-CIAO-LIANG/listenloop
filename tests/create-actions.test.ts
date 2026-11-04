import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSpeech, fakeTranslation } from "@/lib/ai/fake";

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
          providers: { translation: fakeTranslation, speech: fakeSpeech },
          meter: { reserve: state.reserve },
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

const { createPractice, prepareSentences } =
  await import("@/app/materials/actions");

beforeEach(() => {
  state.creator = true;
  state.reserve.mockReset().mockResolvedValue(true);
  state.inserts = [];
  state.deletes = [];
  state.failSentences = false;
});

describe("prepareSentences", () => {
  it("translates Chinese into the English to practice", async () => {
    expect(await prepareSentences("你好。再見。", "zh")).toEqual({
      ok: true,
      sentences: [
        { en: "[en] 你好。", zh: "你好。" },
        { en: "[en] 再見。", zh: "再見。" },
      ],
    });
    expect(state.reserve).toHaveBeenCalledWith("translation", 6);
  });

  it("translates English into Chinese for the handout", async () => {
    expect(await prepareSentences("Hi. Bye.", "en")).toEqual({
      ok: true,
      sentences: [
        { en: "Hi.", zh: "[zh-Hant] Hi." },
        { en: "Bye.", zh: "[zh-Hant] Bye." },
      ],
    });
  });

  it.each([
    ["nothing to practice", "  ---  ", "en", "empty"],
    ["a bad language", "Hi.", "fr", "empty"],
    ["text over the limit", "a".repeat(10_001), "en", "too-long"],
    ["too many sentences", "A.\n".repeat(301), "en", "too-many"],
  ])("refuses %s without spending", async (_, text, language, reason) => {
    expect(await prepareSentences(text, language)).toEqual({
      ok: false,
      reason,
    });
    expect(state.reserve).not.toHaveBeenCalled();
  });

  it("passes on the daily limit", async () => {
    state.reserve.mockResolvedValue(false);
    expect(await prepareSentences("Hi.", "en")).toEqual({
      ok: false,
      reason: "limit",
    });
  });

  it("is unavailable to non-admins", async () => {
    state.creator = false;
    expect(await prepareSentences("Hi.", "en")).toEqual({
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
          { practice_id: "p1", i: 1, en: "Nice.", zh: "" },
        ],
      },
    ]);
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
