import { describe, expect, it, vi } from "vitest";
import { fakeSpeech, fakeLanguage } from "@/lib/ai/fake";
import { meteredSpeech } from "@/lib/ai/metered";
import { getAiProviders } from "@/lib/ai/providers";
import {
  parseVoiceId,
  ProviderError,
  voiceId,
  type AiProviders,
} from "@/lib/ai/types";
import type { UsageMeter } from "@/lib/usage";
import { memoryMeter } from "./memory-meter";

const voice = { accent: "gb", gender: "female" } as const;

const fakes: AiProviders = { language: fakeLanguage, speech: fakeSpeech };

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
      await fakeLanguage.translate(["你好", "再見"], {
        from: "zh-Hant",
        to: "en",
      }),
    ).toEqual({
      value: ["[en] 你好", "[en] 再見"],
      usage: { inputTokens: 0, outputTokens: 0, chars: 4, costUsd: 0 },
    });
  });

  it("returns a playable silent WAV, 0.4 s per word", async () => {
    const { value: audio } = await fakeSpeech.synthesize(
      "one two three four five",
      voice,
    );
    expect(audio.mimeType).toBe("audio/wav");
    const text = new TextDecoder().decode(audio.data.slice(0, 16));
    expect(text.startsWith("RIFF")).toBe(true);
    expect(text.slice(8, 16)).toBe("WAVEfmt ");
    // 2 s at 8000 one-byte samples per second, after a 44-byte header.
    expect(audio.data.length).toBe(44 + 16_000);
  });
});

describe("metered calls", () => {
  it("stops at the limit without calling the provider", async () => {
    const meter = memoryMeter({ speech: 5 });
    const synthesize = vi.fn(fakeSpeech.synthesize);
    const providers = { ...fakes, speech: { id: "test", synthesize } };
    expect(
      await meteredSpeech({ providers, meter }, "too long text", voice),
    ).toEqual({ ok: false, reason: "limit" });
    expect(synthesize).not.toHaveBeenCalled();
  });

  it("keeps the characters counted when the provider fails", async () => {
    const meter = memoryMeter({ speech: 100 });
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
      ...memoryMeter(),
      reserve: vi.fn().mockRejectedValue(new Error()),
    };
    expect(
      await meteredSpeech({ providers: fakes, meter }, "hi", voice),
    ).toEqual({ ok: false, reason: "failed" });
  });

  it.each(["busy", "config"] as const)(
    "passes on a %s provider error",
    async (code) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const providers = {
        ...fakes,
        speech: {
          id: "test",
          synthesize: vi
            .fn()
            .mockRejectedValue(new ProviderError(code, "HTTP")),
        },
      };
      expect(
        await meteredSpeech(
          { providers, meter: memoryMeter({ speech: 100 }) },
          "hi",
          voice,
        ),
      ).toEqual({ ok: false, reason: code });
    },
  );

  it("tells a rate-limited provider apart as busy", async () => {
    const providers = {
      ...fakes,
      speech: {
        id: "test",
        synthesize: vi
          .fn()
          .mockRejectedValue(
            new ProviderError("busy", "429 Too Many Requests"),
          ),
      },
    };
    expect(
      await meteredSpeech(
        { providers, meter: memoryMeter({ speech: 100 }) },
        "hi",
        voice,
      ),
    ).toEqual({ ok: false, reason: "busy" });
  });
});
