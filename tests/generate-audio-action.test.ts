import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSpeech, fakeTranslation } from "@/lib/ai/fake";

type Sentence = { i: number; en: string; audio_path: string | null };
const state = vi.hoisted(() => ({
  creator: true,
  practice: null as {
    voice: string | null;
    practice_sentences: Sentence[];
  } | null,
  updates: [] as { audio_path: string; i: number }[],
  reserve: vi.fn(),
  saved: [] as string[],
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/auth/creator", () => ({
  getCreator: async () =>
    state.creator
      ? {
          user: { id: "user-1", email: "joe@example.com" },
          providers: { translation: fakeTranslation, speech: fakeSpeech },
          meter: { reserve: state.reserve },
          store: {
            find: async () => null,
            save: async (hash: string) => {
              state.saved.push(hash);
              return `${hash}.wav`;
            },
          },
        }
      : null,
}));
vi.mock("@/auth/server", () => ({
  getServerSupabase: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: state.practice, error: null }),
        }),
      }),
      update: (row: { audio_path: string }) => ({
        eq: () => ({
          eq: async (_: string, i: number) => {
            state.updates.push({ audio_path: row.audio_path, i });
            return { error: null };
          },
        }),
      }),
    }),
  }),
}));

const { generatePracticeAudio } = await import("@/app/create/actions");

const sentences = (count: number, voicedCount = 0): Sentence[] =>
  Array.from({ length: count }, (_, i) => ({
    i,
    en: `Sentence ${i}.`,
    audio_path: i < voicedCount ? `${"a".repeat(64)}.wav` : null,
  }));

beforeEach(() => {
  state.creator = true;
  state.updates = [];
  state.saved = [];
  state.reserve.mockReset().mockResolvedValue(true);
  state.practice = { voice: "us-female", practice_sentences: sentences(10) };
});

describe("generatePracticeAudio", () => {
  it("voices the next batch of sentences without audio", async () => {
    expect(await generatePracticeAudio("p1")).toEqual({
      ok: true,
      voiced: 8,
      total: 10,
    });
    expect(state.updates.map((u) => u.i)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("continues where it left off", async () => {
    state.practice = {
      voice: "us-female",
      practice_sentences: sentences(10, 8),
    };
    expect(await generatePracticeAudio("p1")).toEqual({
      ok: true,
      voiced: 10,
      total: 10,
    });
    expect(state.updates.map((u) => u.i)).toEqual([8, 9]);
  });

  it("saves what it made before hitting the limit", async () => {
    state.reserve
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValue(false);
    expect(await generatePracticeAudio("p1")).toEqual({
      ok: false,
      reason: "limit",
      voiced: 2,
      total: 10,
    });
    expect(state.updates).toHaveLength(2);
  });

  it.each([
    ["another user's (or a missing) practice", null],
    ["a practice without a voice", { voice: null, practice_sentences: [] }],
  ])("can't voice %s", async (_, practice) => {
    state.practice = practice;
    expect(await generatePracticeAudio("p1")).toEqual({
      ok: false,
      reason: "not-found",
    });
  });

  it("is unavailable to non-admins", async () => {
    state.creator = false;
    expect(await generatePracticeAudio("p1")).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });
});
