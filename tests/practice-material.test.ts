import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  customPracticeId,
  materialFromCustomPractice,
  parseCustomPracticeId,
  titleLang,
} from "@/lib/practice-material";
import { videos } from "@/data/videos";

const uuid = "0b1d2c3e-4f50-4a6b-8c7d-9e0f1a2b3c4d";
const state = vi.hoisted(() => ({ row: null as unknown, eq: vi.fn() }));
vi.mock("@/auth/server", () => ({
  getServerSupabase: async () => ({
    from: () => ({
      select: () => ({
        eq: (column: string, value: string) => {
          state.eq(column, value);
          return {
            maybeSingle: async () => ({ data: state.row, error: null }),
          };
        },
      }),
    }),
  }),
}));
vi.mock("@/lib/supabase/config", async (original) => ({
  ...(await original<typeof import("@/lib/supabase/config")>()),
  speechAudioUrl: (path: string) => `https://cdn.test/${path}`,
}));
const { getPracticeMaterial } = await import("@/auth/practice-material");

const row = {
  id: uuid,
  title: "第一課",
  vocab: [
    {
      sentence: 1,
      word: "bye",
      pos: "interj.",
      zh: "再見",
      example: "Bye for now.",
    },
    { sentence: 9, word: "out of range", pos: "n.", zh: "x", example: "x" },
  ],
  grammar: [],
  notes_generated_at: "2026-11-03T12:00:00Z",
  practice_sentences: [
    { i: 1, en: "Bye.", zh: "再見。", audio_path: "b.wav" },
    { i: 0, en: "Hi.", zh: "嗨。", audio_path: "a.wav" },
  ],
};

beforeEach(() => {
  state.row = row;
  state.eq.mockClear();
});

describe("created practice ids", () => {
  it("round-trips p-<uuid>", () => {
    expect(customPracticeId(uuid)).toBe(`p-${uuid}`);
    expect(parseCustomPracticeId(`p-${uuid}`)).toBe(uuid);
  });

  it.each(["sintel", "p-", "p-not-a-uuid", uuid, `p-${uuid.toUpperCase()}`])(
    "%j isn't one",
    (id) => {
      expect(parseCustomPracticeId(id)).toBeNull();
    },
  );

  it("marks only built-in titles as English", () => {
    expect(titleLang("sintel")).toBe("en");
    expect(titleLang(`p-${uuid}`)).toBeUndefined();
  });

  it("is never used by a built-in video", () => {
    for (const video of videos) {
      expect(video.id.startsWith("p-"), video.id).toBe(false);
    }
  });
});

describe("materialFromCustomPractice", () => {
  const url = (path: string) => `https://cdn.test/${path}`;

  it("orders sentences and pairs each with its audio", () => {
    expect(materialFromCustomPractice(row, url)).toEqual({
      id: `p-${uuid}`,
      title: "第一課",
      sentences: [
        { i: 0, start: 0, end: 0, en: "Hi.", zh: "嗨。" },
        { i: 1, start: 0, end: 0, en: "Bye.", zh: "再見。" },
      ],
      // Stored notes are checked again: the out-of-range item is dropped.
      vocab: [
        {
          sentence: 1,
          word: "bye",
          pos: "interj.",
          zh: "再見",
          example: "Bye for now.",
        },
      ],
      grammar: [],
      audioUrls: ["https://cdn.test/a.wav", "https://cdn.test/b.wav"],
    });
  });

  it("isn't practicable until its notes are made", () => {
    expect(
      materialFromCustomPractice({ ...row, notes_generated_at: null }, url),
    ).toBeNull();
  });

  it("isn't practicable until every sentence has audio", () => {
    const partial = {
      ...row,
      practice_sentences: [{ ...row.practice_sentences[0], audio_path: null }],
    };
    expect(materialFromCustomPractice(partial, url)).toBeNull();
    expect(
      materialFromCustomPractice({ ...row, practice_sentences: [] }, url),
    ).toBeNull();
  });
});

describe("getPracticeMaterial", () => {
  it("returns built-in videos without touching the database", async () => {
    expect((await getPracticeMaterial("sintel"))?.title).toBe("Sintel");
    expect(state.eq).not.toHaveBeenCalled();
  });

  it("loads the user's created practice by its uuid", async () => {
    const material = await getPracticeMaterial(`p-${uuid}`);
    expect(state.eq).toHaveBeenCalledWith("id", uuid);
    expect(material?.audioUrls).toHaveLength(2);
  });

  it("is null for unknown ids and practices it can't read", async () => {
    expect(await getPracticeMaterial("nope")).toBeNull();
    state.row = null;
    expect(await getPracticeMaterial(`p-${uuid}`)).toBeNull();
  });
});
