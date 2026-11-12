import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  customPracticeId,
  customPracticeReadiness,
  materialFromCustomPractice,
  parseCustomPracticeId,
  titleLang,
} from "@/lib/practice-material";
import { videos } from "@/data/videos";

const uuid = "0b1d2c3e-4f50-4a6b-8c7d-9e0f1a2b3c4d";
const state = vi.hoisted(() => ({
  row: null as unknown,
  eq: vi.fn(),
  user: null as { id: string; email: string } | null,
  ownerId: "owner",
  preview: null as unknown,
  allowed: true,
}));
// Signed out reads with the public key, cached (D133): the same stand-in
// here, and the cache passes straight through.
vi.mock("next/cache", () => ({
  unstable_cache: <A extends unknown[], R>(fn: (...args: A) => R) => fn,
}));
vi.mock("@/auth/public-supabase", async () => ({
  getPublicSupabase: () => standIn(),
}));
const standIn = vi.hoisted(() => () => ({
  // The notes and the preview are read through functions (D106).
  rpc: async (name: string) => {
    const row = state.row as { vocab?: unknown; grammar?: unknown } | null;
    return {
      data:
        name === "practice_notes"
          ? row
            ? [{ vocab: row.vocab, grammar: row.grammar }]
            : []
          : name === "can_practice"
            ? state.allowed
            : state.preview,
      error: null,
    };
  },
  from: () => ({
    select: () => {
      const filters: Record<string, string> = {};
      const query = {
        eq: (column: string, value: string) => {
          state.eq(column, value);
          filters[column] = value;
          return query;
        },
        // The ownership query matches only the owner's id.
        maybeSingle: async () => ({
          data:
            "user_id" in filters && filters.user_id !== state.ownerId
              ? null
              : state.row,
          error: null,
        }),
      };
      return query;
    },
  }),
}));
vi.mock("@/auth/server", () => ({
  getServerSupabase: async () => standIn(),
}));
vi.mock("@/auth/session", () => ({
  getSignedInUser: async () => state.user,
}));
vi.mock("@/lib/supabase/config", async (original) => ({
  ...(await original<typeof import("@/lib/supabase/config")>()),
  speechAudioUrl: (path: string) => `https://cdn.test/${path}`,
}));
const { getPracticeMaterial, getPracticeState } =
  await import("@/auth/practice-material");

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
  state.user = null;
  state.preview = null;
  state.allowed = true;
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
      // An older practice's only title, Chinese here: no second one (D83).
      title: "第一課",
      titleZh: null,
      subtitle: null,
      // Rows read before versions existed are version 1 (D44).
      version: 1,
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
      // No version 2 notes on these rows (D67).
      richNotes: [null, null],
      audioUrls: ["https://cdn.test/a.wav", "https://cdn.test/b.wav"],
      // The voice its words are said in (D136); none on this row.
      voice: null,
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

describe("a practice from the author's own recording (D130)", () => {
  const url = (path: string) => `https://cdn.test/${path}`;
  const recording = {
    ...row,
    source_audio_path: `${uuid}/${uuid}.mp3`,
    practice_sentences: [
      {
        i: 1,
        en: "Bye.",
        zh: "再見。",
        audio_path: null,
        start_sec: 2.5,
        end_sec: 3.4,
      },
      {
        i: 0,
        en: "Hi.",
        zh: "嗨。",
        audio_path: null,
        start_sec: 0.2,
        end_sec: 1.1,
      },
    ],
  };

  it("plays each sentence's times in the one recording", () => {
    const material = materialFromCustomPractice(
      recording,
      url,
      "https://signed.test/rec.mp3?token=x",
    );
    expect(material).toMatchObject({
      sentences: [
        { i: 0, start: 0.2, end: 1.1, en: "Hi." },
        { i: 1, start: 2.5, end: 3.4, en: "Bye." },
      ],
      audioUrls: [
        "https://signed.test/rec.mp3?token=x",
        "https://signed.test/rec.mp3?token=x",
      ],
      audioClips: true,
    });
  });

  it("isn't practicable without its signed URL or its times", () => {
    expect(materialFromCustomPractice(recording, url)).toBeNull();
    expect(
      materialFromCustomPractice(
        {
          ...recording,
          practice_sentences: [
            { ...recording.practice_sentences[0], start_sec: null },
          ],
        },
        url,
        "https://signed.test/rec.mp3",
      ),
    ).toBeNull();
  });

  it("has nothing to voice", () => {
    expect(customPracticeReadiness(recording)).toEqual({
      notesReady: true,
      voiced: 2,
      total: 2,
    });
  });
});

describe("getPracticeMaterial", () => {
  it("returns built-in videos without touching the database", async () => {
    expect((await getPracticeMaterial("sintel"))?.title).toBe("Sintel");
    expect(state.eq).not.toHaveBeenCalled();
  });

  it("loads a created practice by its uuid", async () => {
    const material = await getPracticeMaterial(`p-${uuid}`);
    expect(state.eq).toHaveBeenCalledWith("id", uuid);
    expect(material?.audioUrls).toHaveLength(2);
    // Signed out: someone's public practice, and no author id asked for.
    expect(material?.mine).toBe(false);
    expect(state.eq).not.toHaveBeenCalledWith("user_id", expect.anything());
  });

  it("knows whether the signed-in viewer made it", async () => {
    state.user = { id: "owner", email: "a@example.com" };
    expect((await getPracticeMaterial(`p-${uuid}`))?.mine).toBe(true);
    state.user = { id: "someone-else", email: "b@example.com" };
    expect((await getPracticeMaterial(`p-${uuid}`))?.mine).toBe(false);
  });

  it("is null for unknown ids and practices it can't read", async () => {
    expect(await getPracticeMaterial("nope")).toBeNull();
    state.row = null;
    expect(await getPracticeMaterial(`p-${uuid}`)).toBeNull();
  });
});

describe("customPracticeReadiness", () => {
  it("counts the notes and the sentences with audio", () => {
    expect(customPracticeReadiness(row)).toEqual({
      notesReady: true,
      voiced: 2,
      total: 2,
    });
    expect(
      customPracticeReadiness({
        notes_generated_at: null,
        practice_sentences: [
          { ...row.practice_sentences[0], audio_path: null },
          row.practice_sentences[1],
        ],
      }),
    ).toEqual({ notesReady: false, voiced: 1, total: 2 });
  });
});

describe("getPracticeState", () => {
  // Made before notes existed (test001, D32): the author's link from
  // today's tasks must not answer 404.
  const unfinished = { ...row, notes_generated_at: null };

  it("is ready once notes and audio are made", async () => {
    expect((await getPracticeState(`p-${uuid}`))?.status).toBe("ready");
  });

  it("tells the author an unfinished practice is still preparing", async () => {
    state.row = unfinished;
    state.user = { id: "owner", email: "a@example.com" };
    expect(await getPracticeState(`p-${uuid}`)).toEqual({
      status: "preparing",
      practiceId: uuid,
      title: "第一課",
      readiness: { notesReady: false, voiced: 2, total: 2 },
    });
    // Practice pages still get no material until it's ready.
    expect(await getPracticeMaterial(`p-${uuid}`)).toBeNull();
  });

  it("hides others' unfinished practices", async () => {
    state.row = unfinished;
    expect(await getPracticeState(`p-${uuid}`)).toBeNull();
    state.user = { id: "someone-else", email: "b@example.com" };
    expect(await getPracticeState(`p-${uuid}`)).toBeNull();
  });

  // Shared materials are for paying plans (D106): row level security
  // hides the sentences, and the database gives a preview instead.
  it("gives others a preview when the sentences are hidden", async () => {
    state.row = { ...row, practice_sentences: [] };
    state.user = { id: "someone-else", email: "b@example.com" };
    state.preview = {
      sentence_count: 2,
      sentences: [{ i: 0, en: "Hello.", zh: "你好。" }],
      audio_path: "a.mp3",
    };
    const result = await getPracticeState(`p-${uuid}`);
    expect(result?.status).toBe("preview");
    expect(await getPracticeMaterial(`p-${uuid}`)).toBeNull();
  });

  it("is a 404 when there's no preview either", async () => {
    state.row = { ...row, practice_sentences: [] };
    expect(await getPracticeState(`p-${uuid}`)).toBeNull();
  });

  it("checks can_practice on the server too, before the sentences are hidden", async () => {
    state.user = { id: "someone-else", email: "b@example.com" };
    state.allowed = false;
    state.preview = {
      sentence_count: 2,
      sentences: [{ i: 0, en: "Hello.", zh: "你好。" }],
      audio_path: null,
    };
    expect((await getPracticeState(`p-${uuid}`))?.status).toBe("preview");
    // The author is never sent to the preview.
    state.user = { id: "owner", email: "a@example.com" };
    expect((await getPracticeState(`p-${uuid}`))?.status).toBe("ready");
  });
});
