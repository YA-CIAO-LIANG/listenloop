import { describe, expect, it, vi } from "vitest";
import { fakeLanguage, fakeSpeech } from "@/lib/ai/fake";
import type { AudioStore } from "@/lib/custom-practice/audio";
import { speechCacheKey } from "@/lib/custom-practice/audio";
import { wordAudio, wordCacheKey, wordVoice } from "@/lib/word-audio";
import { memoryMeter } from "./memory-meter";

/** Word audio for the vocabulary quiz (D136): made once, shared. */
function memoryStore(): AudioStore & { files: Map<string, string> } {
  const files = new Map<string, string>();
  return {
    files,
    find: async (hash) => files.get(hash) ?? null,
    save: async (hash) => {
      files.set(hash, `${hash}.wav`);
      return `${hash}.wav`;
    },
  };
}

const voice = { accent: "us", gender: "female" } as const;

describe("word audio (D136)", () => {
  it("is made once and then always comes from the cache", async () => {
    const store = memoryStore();
    const synthesize = vi.spyOn(fakeSpeech, "synthesize");
    const meter = memoryMeter();
    const maker = {
      providers: { language: fakeLanguage, speech: fakeSpeech },
      meter,
    };
    const first = await wordAudio(
      { store, speech: fakeSpeech, maker },
      voice,
      "Station",
    );
    expect(first.ok).toBe(true);
    expect(synthesize).toHaveBeenCalledTimes(1);
    expect(synthesize).toHaveBeenCalledWith("Station", voice);
    // Counted against the daily speech characters.
    expect(meter.reserve).toHaveBeenCalledWith("speech", 7);
    // Anyone, signed in or not, gets the same file next time.
    const again = await wordAudio(
      { store, speech: fakeSpeech, maker: null },
      voice,
      "station",
    );
    expect(again).toEqual(first);
    expect(synthesize).toHaveBeenCalledTimes(1);
    synthesize.mockRestore();
  });

  it("keeps words apart from one-word sentences", async () => {
    expect(await wordCacheKey(fakeSpeech, voice, "Station")).not.toBe(
      await speechCacheKey(fakeSpeech.id, voice, "Station"),
    );
  });

  it("isn't made for someone who may not make it", async () => {
    const store = memoryStore();
    expect(
      await wordAudio(
        { store, speech: fakeSpeech, maker: null },
        voice,
        "quiet",
      ),
    ).toEqual({ ok: false, reason: "missing" });
    expect(store.files.size).toBe(0);
  });

  it("stops at the daily limit without saving", async () => {
    const store = memoryStore();
    const meter = memoryMeter({ speech: 3 });
    const result = await wordAudio(
      {
        store,
        speech: fakeSpeech,
        maker: {
          providers: { language: fakeLanguage, speech: fakeSpeech },
          meter,
        },
      },
      voice,
      "station",
    );
    expect(result).toMatchObject({ ok: false, reason: "limit" });
    expect(store.files.size).toBe(0);
  });

  it("is said in the material's own voice, else its accent, else American", () => {
    expect(wordVoice({ voice: "gb-male" })).toEqual({
      accent: "gb",
      gender: "male",
    });
    expect(wordVoice({ accent: "au" })).toEqual({
      accent: "au",
      gender: "female",
    });
    expect(wordVoice({})).toEqual({ accent: "us", gender: "female" });
  });
});
