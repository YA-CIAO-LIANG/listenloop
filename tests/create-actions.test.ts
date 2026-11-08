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
          user: {
            id: "user-1",
            email: "joe@example.com",
            number: 0,
            role: "admin",
          },
          providers: { language: fakeLanguage, speech: fakeSpeech },
          meter: {
            reserve: state.reserve,
            settle: async () => {},
            log: async () => {},
          },
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
    expect(state.reserve).toHaveBeenCalledWith("cost", expect.any(Number));
  });

  it("takes A:/B: labels off and returns each sentence's speaker (D57)", async () => {
    state.reserve.mockResolvedValue(false);
    expect(await splitText("A: Hi. Bye.\nB: See you.", "en")).toEqual({
      ok: true,
      sentences: ["Hi.", "Bye.", "See you."],
      speakers: [0, 0, 1],
    });
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
    expect(await splitText(text, language)).toMatchObject({
      ok: false,
      reason,
    });
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
    expect(state.reserve).toHaveBeenCalledWith("cost", expect.any(Number));
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
          // An older client's one title is the English one (D83).
          title_en: "Moving",
          title_zh: null,
          subtitle: null,
          source_language: "en",
          voice: "gb-male",
          voice_b: null,
        },
      },
      {
        table: "practice_sentences",
        rows: [
          {
            practice_id: "p1",
            i: 0,
            en: "We moved.",
            zh: "我們搬家了。",
            speaker: null,
          },
          // Chinese left empty in review is translated on save.
          {
            practice_id: "p1",
            i: 1,
            en: "Nice.",
            zh: "[zh-Hant] Nice.",
            speaker: null,
          },
        ],
      },
    ]);
  });

  it("keeps both typed titles exactly, and the subtitle", async () => {
    await createPractice({
      ...draft,
      title: undefined,
      titleEn: "  My  First Move ",
      titleZh: " 第一次 搬家 ",
      subtitle: "搬家時和朋友的對話",
    });
    expect(state.inserts[0].rows).toMatchObject({
      title: "My First Move",
      title_en: "My  First Move",
      title_zh: "第一次 搬家",
      subtitle: "搬家時和朋友的對話",
    });
  });

  it("saves a dialogue's second voice, speakers, and categories (D57)", async () => {
    expect(
      await createPractice({
        ...draft,
        voiceB: "gb-female",
        sentences: [
          { en: "We moved.", zh: "我們搬家了。", speaker: 0 },
          { en: "Nice.", zh: "不錯。", speaker: 1 },
        ],
        meta: {
          category: "daily-life",
          scenario: "supermarket",
          level: "beginner",
          exam: null,
          examTarget: null,
        },
      }),
    ).toEqual({ ok: true, id: "p1" });
    expect(state.inserts[0].rows).toMatchObject({
      voice_b: "gb-female",
      category: "daily-life",
      scenario: "supermarket",
      level: "beginner",
      exam: null,
      exam_target: null,
    });
    expect(
      (state.inserts[1].rows as { speaker: number }[]).map((r) => r.speaker),
    ).toEqual([0, 1]);
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
