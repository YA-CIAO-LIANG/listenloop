import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeLanguage, fakeSpeech } from "@/lib/ai/fake";

const hash = (c: string) => `${c.repeat(64)}.mp3`;
const notes = {
  vocab: [{ word: "home", pos: "n.", zh: "家", example: "I'm home." }],
  grammar: [],
};

const state = vi.hoisted(() => ({
  creator: true,
  practice: null as unknown,
  rpc: vi.fn(),
  filters: [] as [string, unknown][],
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/auth/creator", () => ({
  getCreator: async () =>
    state.creator
      ? {
          user: { id: "user-1", email: "joe@example.com" },
          providers: { language: fakeLanguage, speech: fakeSpeech },
          meter: {
            reserve: async () => true,
            settle: async () => {},
            log: async () => {},
          },
          cache: { get: async () => null, set: async () => {} },
        }
      : null,
}));
vi.mock("@/auth/server", () => ({
  getServerSupabase: async () => ({
    from: () => ({
      select: () => {
        const query = {
          eq: (column: string, value: unknown) => {
            state.filters.push([column, value]);
            return query;
          },
          maybeSingle: async () => ({ data: state.practice, error: null }),
        };
        return query;
      },
    }),
    rpc: state.rpc,
  }),
}));

const { savePracticeEdit } = await import("@/app/materials/edit-actions");

const edit = (sentences: unknown[], extra: object = {}) => ({
  expectedVersion: 2,
  title: "新標題",
  voice: "us-female",
  sentences,
  ...extra,
});

beforeEach(() => {
  state.creator = true;
  state.filters = [];
  state.rpc.mockReset().mockResolvedValue({ data: 3, error: null });
  state.practice = {
    voice: "us-female",
    version: 2,
    source_language: "en",
    practice_sentences: [
      { i: 1, en: "We moved.", audio_path: hash("b"), notes: null },
      { i: 0, en: "Go home.", audio_path: hash("a"), notes },
    ],
  };
});

describe("savePracticeEdit", () => {
  it("saves the next version, keeping unchanged audio and notes, translating the rest", async () => {
    expect(
      await savePracticeEdit(
        "p1",
        edit([
          { en: "Go home.", zh: "回家。", notes: null },
          { en: "Brand new.", zh: "", notes: null },
        ]),
      ),
    ).toEqual({ ok: true, version: 3, notesReady: false, total: 2 });
    expect(state.filters).toEqual([
      ["id", "p1"],
      ["user_id", "user-1"],
    ]);
    const [name, args] = state.rpc.mock.calls[0];
    expect(name).toBe("save_practice_edit");
    expect(args).toMatchObject({
      target: "p1",
      expected_version: 2,
      new_title: "新標題",
      new_voice: "us-female",
      notes_ready: false,
      new_sentences: [
        { en: "Go home.", zh: "回家。", audio_path: hash("a"), notes },
        {
          en: "Brand new.",
          zh: "[zh-Hant] Brand new.",
          audio_path: null,
          notes: null,
        },
      ],
    });
  });

  it("joins the notes when every sentence has them", async () => {
    const result = await savePracticeEdit(
      "p1",
      edit([{ en: "Go home.", zh: "回家。", notes: null }]),
    );
    expect(result).toMatchObject({ ok: true, notesReady: true });
    expect(state.rpc.mock.calls[0][1]).toMatchObject({
      notes_ready: true,
      new_vocab: [{ sentence: 0, word: "home" }],
    });
  });

  it("refuses a stale editor", async () => {
    expect(
      await savePracticeEdit(
        "p1",
        edit([{ en: "Go home.", zh: "回家。", notes: null }], {
          expectedVersion: 1,
        }),
      ),
    ).toEqual({ ok: false, reason: "conflict" });
    state.rpc.mockResolvedValue({
      data: null,
      error: { message: "version conflict" },
    });
    expect(
      await savePracticeEdit(
        "p1",
        edit([{ en: "Go home.", zh: "回家。", notes: null }]),
      ),
    ).toEqual({ ok: false, reason: "conflict" });
  });

  it("checks the edit", async () => {
    expect(
      await savePracticeEdit("p1", edit([{ en: " ", zh: "", notes: null }])),
    ).toMatchObject({
      ok: false,
      reason: "invalid",
      problem: "sentence-empty",
    });
    expect(
      await savePracticeEdit(
        "p1",
        edit([
          {
            en: "Go home.",
            zh: "回家。",
            notes: { vocab: [{ word: "" }], grammar: [] },
          },
        ]),
      ),
    ).toMatchObject({
      ok: false,
      reason: "invalid",
      problem: "notes",
      sentence: 0,
    });
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it("is only for the author, and only while creating is open", async () => {
    state.practice = null;
    expect(await savePracticeEdit("p1", edit([]))).toEqual({
      ok: false,
      reason: "not-found",
    });
    state.creator = false;
    expect(await savePracticeEdit("p1", edit([]))).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });
});
