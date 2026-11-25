import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeLanguage, fakeSpeech, fakeTranscriber } from "@/lib/ai/fake";
import { encodeWav } from "@/lib/upload-audio";

const USER = "11111111-1111-4111-8111-111111111111";
const FILE = "22222222-2222-4222-8222-222222222222.mp3";
const PATH = `${USER}/${FILE}`;

type Insert = { table: string; rows: unknown };
const state = vi.hoisted(() => ({
  plan: "paid" as "free" | "paid" | "admin",
  quota: true,
  allowAudio: vi.fn(),
  logs: [] as unknown[],
  inserts: [] as Insert[],
  files: [] as string[],
  uploadUrls: [] as string[],
  /** The stored file's first bytes (D159): an MP3 frame header by default. */
  head: [0xff, 0xfb, 0x90, 0x64] as number[],
  removed: [] as string[],
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/auth/events", () => ({ logEvent: vi.fn() }));
vi.mock("@/auth/rate-limit", () => ({ allowAction: async () => true }));
// The account's own quota changes and storage (D161): none here.
vi.mock("@/auth/quota", async () => {
  const { PLANS } = await import("@/lib/plans");
  return {
    plansFor: async (_user: unknown, base = PLANS) => base,
    storedUploadBytes: async () => 0,
  };
});
vi.mock("@/auth/creation-quota", () => ({
  creationAllowed: async () =>
    state.quota ? { ok: true } : { ok: false, limit: "wordsPerMonth", max: 40 },
}));
vi.mock("@/auth/creator", () => ({
  getCreator: async () => ({
    user: {
      id: USER,
      email: "a@example.com",
      number: 1,
      role: state.plan === "admin" ? "admin" : "user",
      plan: state.plan === "admin" ? "free" : state.plan,
    },
    providers: {
      language: fakeLanguage,
      speech: fakeSpeech,
      transcribe: fakeTranscriber,
    },
    meter: {
      reserve: async () => true,
      settle: async () => {},
      log: async (entry: unknown) => {
        state.logs.push(entry);
      },
      allowAudio: state.allowAudio,
    },
    cache: { get: async () => null, set: async () => {} },
  }),
}));
vi.mock("@/auth/admin", () => ({
  getAdminSupabase: () => ({
    storage: {
      from: () => ({
        createSignedUploadUrl: async (path: string) => {
          state.uploadUrls.push(path);
          return { data: { path, token: "t0k" }, error: null };
        },
        list: async (_folder: string, { search }: { search: string }) => ({
          data: state.files
            .filter((name) => name === search)
            .map((name) => ({ name, metadata: { size: 120_000 } })),
          error: null,
        }),
        createSignedUrl: async () => ({
          data: { signedUrl: "https://storage.test/signed" },
          error: null,
        }),
        remove: async (paths: string[]) => {
          state.removed.push(...paths);
          return { data: null, error: null };
        },
      }),
    },
  }),
}));
vi.mock("@/auth/server", () => ({
  getServerSupabase: async () => ({
    from: (table: string) => ({
      insert: (rows: unknown) => {
        state.inserts.push({ table, rows });
        return {
          error: null,
          select: () => ({
            single: async () => ({ data: { id: "p1" }, error: null }),
          }),
        };
      },
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
  }),
}));

const { createUploadPractice, startAudioUpload, transcribeAudio } =
  await import("@/app/materials/upload-actions");

beforeEach(() => {
  state.plan = "paid";
  state.quota = true;
  state.allowAudio.mockReset().mockResolvedValue(true);
  state.logs = [];
  state.inserts = [];
  state.files = [FILE];
  state.uploadUrls = [];
});

const wav = (seconds: number) =>
  new Blob([encodeWav(new Float32Array(seconds * 16_000), 16_000) as BlobPart]);

function form(pieces: { start: number; end: number }[], path = PATH) {
  const data = new FormData();
  data.set("path", path);
  data.set("pieces", JSON.stringify(pieces));
  pieces.forEach((piece, i) =>
    data.set(`piece-${i}`, wav(piece.end - piece.start)),
  );
  return data;
}

describe("startAudioUpload (D130)", () => {
  it("gives a one-time upload URL in the user's own folder", async () => {
    const result = await startAudioUpload({
      sourceBytes: 20e6,
      bytes: 2e6,
      seconds: 120,
    });
    expect(result).toMatchObject({ ok: true, token: "t0k" });
    expect(state.uploadUrls[0]).toMatch(
      new RegExp(`^${USER}/[0-9a-f-]{36}\\.mp3$`),
    );
  });

  it("is Plus and up, within the plan's size and length", async () => {
    state.plan = "free";
    expect(
      await startAudioUpload({ sourceBytes: 1e6, bytes: 1e5, seconds: 10 }),
    ).toEqual({ ok: false, reason: "plan", limit: "uploadAudio" });
    state.plan = "paid";
    expect(
      await startAudioUpload({
        sourceBytes: 150 * 1024 * 1024,
        bytes: 1e6,
        seconds: 10,
      }),
    ).toEqual({
      ok: false,
      reason: "plan",
      limit: "uploadMegabytes",
      max: 100,
    });
    expect(
      await startAudioUpload({ sourceBytes: 1e6, bytes: 1e5, seconds: 301 }),
    ).toEqual({ ok: false, reason: "too-long" });
    expect(
      await startAudioUpload({ sourceBytes: 1e6, bytes: 60e6, seconds: 60 }),
    ).toEqual({ ok: false, reason: "too-big" });
    state.quota = false;
    expect(
      await startAudioUpload({ sourceBytes: 1e6, bytes: 1e5, seconds: 10 }),
    ).toEqual({
      ok: false,
      reason: "plan",
      limit: "wordsPerMonth",
      max: 40,
    });
    expect(state.uploadUrls).toEqual([]);
  });
});

describe("transcribeAudio (D130)", () => {
  it("writes down each piece, with its place in the recording", async () => {
    const result = await transcribeAudio(
      form([
        { start: 1, end: 4 },
        { start: 5, end: 7 },
      ]),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.heard).toHaveLength(2);
    expect(result.heard[0]).toMatchObject({ start: 1, end: 4 });
    expect(result.heard[0].text).toMatch(/\.$/);
    // Each piece counts against the month: Plus all-in-one has 3,000
    // words, 20 minutes (D210).
    expect(state.allowAudio).toHaveBeenCalledWith(3000, 1_200_000);
    expect(state.logs).toHaveLength(2);
  });

  it("only takes the user's own upload and real 16 kHz WAV pieces", async () => {
    const other = `33333333-3333-4333-8333-333333333333/${FILE}`;
    expect(await transcribeAudio(form([{ start: 0, end: 2 }], other))).toEqual({
      ok: false,
      reason: "invalid",
    });
    const wrongLength = form([{ start: 0, end: 2 }]);
    wrongLength.set("piece-0", wav(5));
    expect(await transcribeAudio(wrongLength)).toEqual({
      ok: false,
      reason: "invalid",
    });
    const notWav = form([{ start: 0, end: 2 }]);
    notWav.set("piece-0", new Blob([new Uint8Array(64_044)]));
    expect(await transcribeAudio(notWav)).toEqual({
      ok: false,
      reason: "invalid",
    });
    const tooMany = form(
      Array.from({ length: 13 }, (_, i) => ({ start: i, end: i + 0.5 })),
    );
    expect(await transcribeAudio(tooMany)).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(state.logs).toEqual([]);
  });

  it("stops when the month's speech to text is used up", async () => {
    state.allowAudio.mockResolvedValue(false);
    expect(await transcribeAudio(form([{ start: 0, end: 2 }]))).toEqual({
      ok: false,
      reason: "limit",
    });
  });
});

describe("createUploadPractice (D130)", () => {
  beforeEach(() => {
    state.head = [0xff, 0xfb, 0x90, 0x64];
    state.removed = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array(state.head))),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("refuses and removes a file that isn't really an MP3 (D159)", async () => {
    state.files = [FILE];
    state.head = [0x3c, 0x68, 0x74, 0x6d]; // "<htm"
    expect(
      await createUploadPractice({ path: PATH, seconds: 4.2, sentences }),
    ).toEqual({ ok: false, reason: "invalid" });
    expect(state.removed).toEqual([PATH]);
    expect(state.inserts).toEqual([]);
  });

  const sentences = [
    { en: "Good morning everyone.", zh: "大家早安。", start: 0.1, end: 1.6 },
    {
      en: "Today we talk about sleep.",
      zh: "今天談睡眠。",
      start: 1.6,
      end: 3.9,
    },
  ];

  it("saves a private practice that plays the recording", async () => {
    const result = await createUploadPractice({
      path: PATH,
      seconds: 4.2,
      titleEn: "Sleep",
      titleZh: "",
      sentences,
    });
    expect(result).toEqual({ ok: true, id: "p1" });
    expect(state.inserts[0]).toEqual({
      table: "practices",
      rows: expect.objectContaining({
        user_id: USER,
        source_audio_path: PATH,
        source_audio_seconds: 4.2,
        visibility: "private",
        estimated_seconds: 4,
        duration_sec: 4,
      }),
    });
    expect(state.inserts[1]).toEqual({
      table: "practice_sentences",
      rows: [
        expect.objectContaining({ i: 0, start_sec: 0.1, end_sec: 1.6 }),
        expect.objectContaining({ i: 1, start_sec: 1.6, end_sec: 3.9 }),
      ],
    });
  });

  it("needs the uploaded file, in order and inside the recording", async () => {
    state.files = [];
    expect(
      await createUploadPractice({ path: PATH, seconds: 4.2, sentences }),
    ).toEqual({ ok: false, reason: "invalid" });
    state.files = [FILE];
    expect(
      await createUploadPractice({
        path: PATH,
        seconds: 4.2,
        sentences: [sentences[1], sentences[0]],
      }),
    ).toEqual({ ok: false, reason: "invalid" });
    expect(
      await createUploadPractice({
        path: PATH,
        seconds: 2,
        sentences,
      }),
    ).toEqual({ ok: false, reason: "invalid" });
    expect(state.inserts).toEqual([]);
  });
});
