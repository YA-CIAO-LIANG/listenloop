import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeLanguage, fakeSpeech } from "@/lib/ai/fake";
import { NOTES_CHUNK } from "@/lib/custom-practice/notes";

const state = vi.hoisted(() => ({
  creator: true,
  practice: null as unknown,
  updates: [] as Record<string, unknown>[],
  reserve: vi.fn(),
  filters: [] as [string, string][],
  cache: new Map<string, unknown>(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/auth/creator", () => ({
  getCreator: async () =>
    state.creator
      ? {
          user: { id: "user-1", email: "joe@example.com" },
          providers: { language: fakeLanguage, speech: fakeSpeech },
          meter: {
            reserve: state.reserve,
            settle: async () => {},
            log: async () => {},
          },
          cache: {
            get: async (hash: string) => state.cache.get(hash) ?? null,
            set: async (hash: string, _: string, value: unknown) => {
              state.cache.set(hash, value);
            },
          },
        }
      : null,
}));
vi.mock("@/auth/server", () => ({
  getServerSupabase: async () => ({
    from: () => ({
      select: () => {
        const query = {
          eq: (column: string, value: string) => {
            state.filters.push([column, value]);
            return query;
          },
          maybeSingle: async () => ({ data: state.practice, error: null }),
        };
        return query;
      },
      update: (row: Record<string, unknown>) => ({
        eq: () => ({
          select: async () => {
            state.updates.push(row);
            return { data: [{ id: "p1" }], error: null };
          },
        }),
      }),
    }),
  }),
}));

const { generatePracticeNotes } = await import("@/app/materials/actions");

beforeEach(() => {
  state.cache.clear();
  state.creator = true;
  state.filters = [];
  state.updates = [];
  state.reserve.mockReset().mockResolvedValue(true);
  state.practice = {
    notes_generated_at: null,
    practice_sentences: [
      { i: 1, en: "Wonderful weather today." },
      { i: 0, en: "We moved here." },
    ],
  };
});

describe("generatePracticeNotes", () => {
  it("saves notes made from the saved English, in sentence order", async () => {
    expect(await generatePracticeNotes("p1")).toEqual({
      ok: true,
      annotated: 2,
      total: 2,
    });
    const [saved] = state.updates;
    expect(
      (saved.vocab as { sentence: number; word: string }[]).map((v) => [
        v.sentence,
        v.word,
      ]),
    ).toEqual([
      [0, "moved"],
      [1, "wonderful"],
    ]);
    expect(typeof saved.notes_generated_at).toBe("string");
  });

  it("does nothing when the notes already exist", async () => {
    state.practice = {
      notes_generated_at: "2026-11-03T00:00:00Z",
      practice_sentences: [{ i: 0, en: "Hi." }],
    };
    expect(await generatePracticeNotes("p1")).toEqual({
      ok: true,
      annotated: 1,
      total: 1,
    });
    expect(state.reserve).not.toHaveBeenCalled();
    expect(state.updates).toEqual([]);
  });

  it(`makes one chunk (${NOTES_CHUNK} sentences) per call, saving at the end`, async () => {
    state.practice = {
      notes_generated_at: null,
      practice_sentences: Array.from({ length: NOTES_CHUNK + 3 }, (_, i) => ({
        i,
        en: `Sentence number ${i}.`,
      })),
    };
    expect(await generatePracticeNotes("p1")).toEqual({
      ok: true,
      annotated: NOTES_CHUNK,
      total: NOTES_CHUNK + 3,
    });
    expect(state.updates).toEqual([]);
    expect(await generatePracticeNotes("p1")).toEqual({
      ok: true,
      annotated: NOTES_CHUNK + 3,
      total: NOTES_CHUNK + 3,
    });
    expect(state.updates).toHaveLength(1);
    // The first chunk came from the cache the second time.
    expect(state.reserve).toHaveBeenCalledTimes(2);
  });

  it("saves nothing when today's allowance is used up", async () => {
    state.reserve.mockResolvedValue(false);
    expect(await generatePracticeNotes("p1")).toEqual({
      ok: false,
      reason: "limit",
    });
    expect(state.updates).toEqual([]);
  });

  it("can't make notes for someone else's practice", async () => {
    state.practice = null;
    expect(await generatePracticeNotes("p1")).toEqual({
      ok: false,
      reason: "not-found",
    });
    // Asks for the user's own: others' public practices are readable too.
    expect(state.filters).toEqual([
      ["id", "p1"],
      ["user_id", "user-1"],
    ]);
  });

  it("is unavailable to non-admins", async () => {
    state.creator = false;
    expect(await generatePracticeNotes("p1")).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });
});
