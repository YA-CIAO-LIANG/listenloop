import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeLanguage, fakeSpeech } from "@/lib/ai/fake";
import { NOTES_CHUNK } from "@/lib/custom-practice/notes";
import { memoryMeter } from "./memory-meter";

/** Regenerating official notes in a batch (D80), with the fakes. */
const state = vi.hoisted(() => ({
  practice: null as Record<string, unknown> | null,
  rpc: vi.fn(),
  cache: new Map<string, unknown>(),
  meter: null as unknown,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/auth/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/auth/creator", () => ({
  getBatchCreator: async () => ({
    user: { id: "admin-1", role: "admin" },
    providers: { language: fakeLanguage, speech: fakeSpeech },
    meter: state.meter,
    cache: {
      get: async (hash: string) => state.cache.get(hash) ?? null,
      set: async (hash: string, _kind: string, value: unknown) => {
        state.cache.set(hash, value);
      },
    },
  }),
}));
vi.mock("@/auth/admin", () => ({
  getAdminSupabase: () => ({
    from: () => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        is: () => chain,
        maybeSingle: async () => ({ data: state.practice, error: null }),
      };
      return chain;
    },
    rpc: async (name: string, args: unknown) => (
      state.rpc(name, args),
      { data: 3, error: null }
    ),
  }),
}));

const { upgradeOfficialNotes } = await import("@/app/admin/official/actions");
const id = "00000000-0000-4000-8000-000000000009";
const sentences = Array.from({ length: NOTES_CHUNK + 2 }, (_, i) => ({
  i,
  en: `This is practice sentence number ${i + 1}.`,
  notes: null,
}));

beforeEach(() => {
  state.practice = { id, official: true, practice_sentences: sentences };
  state.rpc.mockReset();
  state.cache.clear();
  state.meter = memoryMeter();
});

describe("upgradeOfficialNotes", () => {
  it("makes notes a chunk per call, then moves to the next version", async () => {
    expect(await upgradeOfficialNotes(id)).toEqual({
      ok: true,
      done: NOTES_CHUNK,
      total: NOTES_CHUNK + 2,
    });
    expect(state.rpc).not.toHaveBeenCalled();
    const last = await upgradeOfficialNotes(id);
    expect(last).toEqual({
      ok: true,
      done: NOTES_CHUNK + 2,
      total: NOTES_CHUNK + 2,
      version: 3,
    });
    expect(state.rpc).toHaveBeenCalledWith(
      "upgrade_practice_notes",
      expect.objectContaining({ target: id }),
    );
  });

  it("costs nothing for notes already current", async () => {
    await upgradeOfficialNotes(id);
    await upgradeOfficialNotes(id);
    const notes = state.rpc.mock.calls[0][1].new_notes;
    state.practice = {
      id,
      official: true,
      practice_sentences: sentences.map((s, i) => ({ ...s, notes: notes[i] })),
    };
    state.meter = memoryMeter({ cost: -1 });
    expect(await upgradeOfficialNotes(id)).toEqual({
      ok: true,
      done: NOTES_CHUNK + 2,
      total: NOTES_CHUNK + 2,
      upToDate: true,
    });
  });

  it("stops at the batch limit, and refuses what isn't official", async () => {
    // The fake costs nothing: a limit below zero refuses even that.
    state.meter = memoryMeter({ cost: -1 });
    expect(await upgradeOfficialNotes(id)).toMatchObject({
      ok: false,
      reason: "limit",
    });
    state.practice = { ...state.practice, official: false };
    expect(await upgradeOfficialNotes(id)).toEqual({
      ok: false,
      reason: "not-found",
    });
    expect(await upgradeOfficialNotes("x")).toEqual({
      ok: false,
      reason: "invalid",
    });
  });
});
