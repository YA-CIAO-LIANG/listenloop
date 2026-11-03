import { describe, expect, it, vi } from "vitest";
import { generateAllAudio } from "@/components/audio-generation";
import { fakeSpeech, fakeTranslation } from "@/lib/ai/fake";
import type { SpeechAudio } from "@/lib/ai/types";
import {
  audioFileName,
  speechCacheKey,
  voiceSentences,
  type AudioStore,
} from "@/lib/custom-practice/audio";
import { readSupabaseConfig, speechAudioUrl } from "@/lib/supabase/config";

const voice = { accent: "us", gender: "female" } as const;

function memoryStore(): AudioStore & { files: Map<string, SpeechAudio> } {
  const files = new Map<string, SpeechAudio>();
  return {
    files,
    find: async (hash) =>
      files.has(hash) ? audioFileName(hash, files.get(hash)!.mimeType) : null,
    save: async (hash, audio) => {
      files.set(hash, audio);
      return audioFileName(hash, audio.mimeType);
    },
  };
}

function deps(limit = 1_000) {
  let used = 0;
  const reserve = vi.fn(async (_kind: string, chars: number) => {
    if (used + chars > limit) return false;
    used += chars;
    return true;
  });
  const synthesize = vi.fn(fakeSpeech.synthesize);
  return {
    providers: {
      translation: fakeTranslation,
      speech: { id: "fake", synthesize },
    },
    meter: { reserve },
    store: memoryStore(),
    reserve,
    synthesize,
  };
}

describe("speechCacheKey", () => {
  it("is a stable SHA-256 of provider, voice, and text", async () => {
    const key = await speechCacheKey("fake", voice, "Hello.");
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(await speechCacheKey("fake", voice, "Hello.")).toBe(key);
    expect(await speechCacheKey("google", voice, "Hello.")).not.toBe(key);
    expect(
      await speechCacheKey("fake", { ...voice, accent: "gb" }, "Hello."),
    ).not.toBe(key);
    expect(await speechCacheKey("fake", voice, "Hello!")).not.toBe(key);
  });

  it("names files by format", () => {
    expect(audioFileName("ab", "audio/mpeg")).toBe("ab.mp3");
    expect(audioFileName("ab", "audio/wav")).toBe("ab.wav");
  });
});

describe("voiceSentences", () => {
  const sentences = [
    { i: 0, en: "Hello." },
    { i: 1, en: "Goodbye." },
  ];

  it("generates each sentence once, then reuses the cached file for free", async () => {
    const d = deps();
    const first = await voiceSentences(d, voice, sentences);
    expect(first.stopped).toBeUndefined();
    expect(first.done.map((s) => s.i)).toEqual([0, 1]);
    expect(d.synthesize).toHaveBeenCalledTimes(2);
    expect(d.reserve).toHaveBeenCalledWith("speech", 6);

    // Same text and voice in another practice: no API call, nothing counted.
    const again = await voiceSentences(d, voice, [{ i: 5, en: "Hello." }]);
    expect(again.done).toEqual([{ i: 5, path: first.done[0].path }]);
    expect(d.synthesize).toHaveBeenCalledTimes(2);
    expect(d.reserve).toHaveBeenCalledTimes(2);
  });

  it("stops at the daily limit and keeps what was done", async () => {
    const d = deps(7);
    expect(await voiceSentences(d, voice, sentences)).toEqual({
      done: [{ i: 0, path: expect.stringMatching(/\.wav$/) }],
      stopped: "limit",
    });
  });

  it("stops when storing fails", async () => {
    const d = deps();
    d.store.save = vi.fn().mockRejectedValue(new Error("storage down"));
    expect(await voiceSentences(d, voice, sentences)).toEqual({
      done: [],
      stopped: "failed",
    });
  });
});

describe("generateAllAudio", () => {
  it("calls batch after batch until every sentence has audio", async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, voiced: 8, total: 12 })
      .mockResolvedValueOnce({ ok: true, voiced: 12, total: 12 });
    const progress: number[] = [];
    expect(
      await generateAllAudio(generate, "p1", (voiced) => progress.push(voiced)),
    ).toEqual({ ok: true, voiced: 12, total: 12 });
    expect(progress).toEqual([8, 12]);
  });

  it("stops on an error, and when a batch makes no progress", async () => {
    const limit = vi
      .fn()
      .mockResolvedValue({ ok: false, reason: "limit", voiced: 3, total: 9 });
    expect((await generateAllAudio(limit, "p1", () => {})).ok).toBe(false);
    expect(limit).toHaveBeenCalledTimes(1);

    const stuck = vi.fn().mockResolvedValue({ ok: true, voiced: 3, total: 9 });
    expect(await generateAllAudio(stuck, "p1", () => {})).toMatchObject({
      ok: false,
      reason: "failed",
    });
    expect(stuck).toHaveBeenCalledTimes(2);
  });

  it("treats a thrown error as a failure", async () => {
    const generate = vi.fn().mockRejectedValue(new Error("offline"));
    expect(await generateAllAudio(generate, "p1", () => {})).toEqual({
      ok: false,
      reason: "failed",
    });
  });
});

describe("speechAudioUrl", () => {
  it("points at the public speech bucket", () => {
    const config = readSupabaseConfig("https://abc.supabase.co", "key");
    expect(speechAudioUrl("ab.wav", config)).toBe(
      "https://abc.supabase.co/storage/v1/object/public/speech/ab.wav",
    );
    expect(speechAudioUrl("ab.wav", null)).toBeNull();
  });
});
