import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeLanguage, fakeSpeech } from "@/lib/ai/fake";

/** wordAudioUrl (D136): only this material's quiz words, shared cache. */
const state = vi.hoisted(() => ({
  files: new Map<string, string>(),
  user: null as { id: string } | null,
  synthesize: 0,
}));

vi.mock("@/auth/practice-material", () => ({
  getPracticeMaterial: async (id: string) =>
    id === "sintel"
      ? {
          id,
          title: "Sintel",
          sentences: [
            { i: 0, start: 0, end: 1, en: "A dragon.", zh: "一條龍。" },
          ],
          vocab: [
            { sentence: 0, word: "dragon", pos: "n.", zh: "龍", example: "" },
          ],
          grammar: [],
          youtubeId: "abcdefghijk",
        }
      : null,
}));
vi.mock("@/lib/ai/providers", () => ({
  getAiProviders: () => ({ language: fakeLanguage, speech: fakeSpeech }),
}));
vi.mock("@/auth/admin", () => ({ getAdminSupabase: () => ({}) }));
vi.mock("@/auth/audio-store", () => ({
  supabaseAudioStore: () => ({
    find: async (hash: string) => state.files.get(hash) ?? null,
    save: async (hash: string) => {
      state.synthesize++;
      state.files.set(hash, `${hash}.wav`);
      return `${hash}.wav`;
    },
  }),
}));
vi.mock("@/auth/session", () => ({ getSignedInUser: async () => state.user }));
vi.mock("@/auth/rate-limit", () => ({ allowAction: async () => true }));
vi.mock("@/auth/creator", () => ({
  getCreator: async () => ({
    providers: { language: fakeLanguage, speech: fakeSpeech },
    meter: {
      reserve: async () => true,
      settle: async () => {},
      log: async () => {},
    },
  }),
}));
vi.mock("@/lib/supabase/config", async (original) => ({
  ...(await original<typeof import("@/lib/supabase/config")>()),
  speechAudioUrl: (path: string) => `https://cdn.test/${path}`,
}));

const { wordAudioUrl } = await import("@/app/videos/[id]/quiz/actions");

beforeEach(() => {
  state.files.clear();
  state.user = null;
  state.synthesize = 0;
});

describe("wordAudioUrl (D136)", () => {
  it("makes a quiz word once for a signed-in learner, then serves it to anyone", async () => {
    expect(await wordAudioUrl("sintel", "Dragon")).toEqual({
      ok: false,
      reason: "missing",
    });
    state.user = { id: "u1" };
    const made = await wordAudioUrl("sintel", "dragon");
    expect(made).toMatchObject({ ok: true });
    state.user = null;
    expect(await wordAudioUrl("sintel", "DRAGON")).toEqual(made);
    expect(state.synthesize).toBe(1);
  });

  it("refuses words that aren't this material's quiz words", async () => {
    state.user = { id: "u1" };
    expect(await wordAudioUrl("sintel", "anything else")).toEqual({
      ok: false,
      reason: "unavailable",
    });
    expect(await wordAudioUrl("nope", "dragon")).toEqual({
      ok: false,
      reason: "unavailable",
    });
    expect(state.synthesize).toBe(0);
  });
});
