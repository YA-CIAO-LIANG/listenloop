import { describe, expect, it, vi } from "vitest";
import { fakeSpeech, fakeTranslation } from "@/lib/ai/fake";
import { meteredSpeech, meteredTranslate } from "@/lib/ai/metered";
import { getAiProviders } from "@/lib/ai/providers";
import { parseVoiceId, voiceId, type AiProviders } from "@/lib/ai/types";
import type { UsageMeter } from "@/lib/usage";

const voice = { accent: "gb", gender: "female" } as const;

/** A meter with a running total per kind, like the database function. */
function memoryMeter(
  limit: number,
): UsageMeter & { used: Map<string, number> } {
  const used = new Map<string, number>();
  return {
    used,
    async reserve(kind, chars) {
      const total = (used.get(kind) ?? 0) + chars;
      if (total > limit) return false;
      used.set(kind, total);
      return true;
    },
  };
}

const fakes: AiProviders = { translation: fakeTranslation, speech: fakeSpeech };

describe("voices", () => {
  it("round-trips voice ids", () => {
    expect(voiceId(voice)).toBe("gb-female");
    expect(parseVoiceId("gb-female")).toEqual(voice);
  });

  it.each(["", "gb", "fr-female", "gb-child", "gb-female-x"])(
    "rejects %j",
    (id) => {
      expect(parseVoiceId(id)).toBeNull();
    },
  );
});

describe("getAiProviders", () => {
  it("is off unless configured", () => {
    expect(getAiProviders({})).toBeNull();
    expect(getAiProviders({ AI_PROVIDERS: "google" })).toBeNull();
  });

  it("uses the fakes when asked, except on the production site", () => {
    expect(getAiProviders({ AI_PROVIDERS: "fake" })).toEqual(fakes);
    expect(
      getAiProviders({ AI_PROVIDERS: "fake", VERCEL_ENV: "preview" }),
    ).toEqual(fakes);
    expect(
      getAiProviders({ AI_PROVIDERS: "fake", VERCEL_ENV: "production" }),
    ).toBeNull();
  });
});

describe("fake providers", () => {
  it("translates each line, in order", async () => {
    expect(
      await fakeTranslation.translate(["你好", "再見"], {
        from: "zh-Hant",
        to: "en",
      }),
    ).toEqual(["[en] 你好", "[en] 再見"]);
  });

  it("returns a playable silent WAV, 0.4 s per word", async () => {
    const audio = await fakeSpeech.synthesize("one two three four five", voice);
    expect(audio.mimeType).toBe("audio/wav");
    const text = new TextDecoder().decode(audio.data.slice(0, 16));
    expect(text.startsWith("RIFF")).toBe(true);
    expect(text.slice(8, 16)).toBe("WAVEfmt ");
    // 2 s at 8000 one-byte samples per second, after a 44-byte header.
    expect(audio.data.length).toBe(44 + 16_000);
  });
});

describe("metered calls", () => {
  it("counts characters and calls the provider within the limit", async () => {
    const meter = memoryMeter(10);
    expect(
      await meteredTranslate({ providers: fakes, meter }, ["你好", "再見"], {
        from: "zh-Hant",
        to: "en",
      }),
    ).toEqual({ ok: true, value: ["[en] 你好", "[en] 再見"] });
    expect(meter.used.get("translation")).toBe(4);
  });

  it("stops at the limit without calling the provider", async () => {
    const meter = memoryMeter(5);
    const synthesize = vi.fn(fakeSpeech.synthesize);
    const providers = { ...fakes, speech: { id: "test", synthesize } };
    expect(
      await meteredSpeech({ providers, meter }, "too long text", voice),
    ).toEqual({ ok: false, reason: "limit" });
    expect(synthesize).not.toHaveBeenCalled();
  });

  it("keeps the characters counted when the provider fails", async () => {
    const meter = memoryMeter(100);
    const providers = {
      ...fakes,
      speech: {
        id: "test",
        synthesize: vi.fn().mockRejectedValue(new Error("down")),
      },
    };
    expect(await meteredSpeech({ providers, meter }, "hello", voice)).toEqual({
      ok: false,
      reason: "failed",
    });
    expect(meter.used.get("speech")).toBe(5);
  });

  it("fails when the meter can't be reached", async () => {
    const meter: UsageMeter = {
      reserve: vi.fn().mockRejectedValue(new Error()),
    };
    expect(
      await meteredSpeech({ providers: fakes, meter }, "hi", voice),
    ).toEqual({ ok: false, reason: "failed" });
  });

  it("rejects a translation with the wrong number of lines", async () => {
    const providers = {
      ...fakes,
      translation: { translate: vi.fn().mockResolvedValue(["only one"]) },
    };
    expect(
      await meteredTranslate(
        { providers, meter: memoryMeter(100) },
        ["a", "b"],
        {
          from: "zh-Hant",
          to: "en",
        },
      ),
    ).toEqual({ ok: false, reason: "failed" });
  });

  it("spends nothing on an empty translation", async () => {
    const meter = memoryMeter(0);
    expect(
      await meteredTranslate({ providers: fakes, meter }, [], {
        from: "zh-Hant",
        to: "en",
      }),
    ).toEqual({ ok: true, value: [] });
  });
});
