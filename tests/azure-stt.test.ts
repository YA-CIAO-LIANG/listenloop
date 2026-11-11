import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { azureTranscriber, readShortAudio } from "@/lib/ai/azure-stt";
import { fakeTranscriber, FAKE_HEARD } from "@/lib/ai/fake";
import { meteredTranscribe } from "@/lib/ai/metered";
import { fakeLanguage, fakeSpeech } from "@/lib/ai/fake";
import { ProviderError } from "@/lib/ai/types";
import { TRANSCRIBE_MONTHLY_SECONDS } from "@/lib/ai/pricing";
import { findSpeechSegments, heardSentences } from "@/lib/upload-audio";
import { memoryMeter } from "./memory-meter";

/**
 * Speech to text (D130), against the real answer recorded once by
 * `npm run ai:record` (tests/fixtures/ai/azure-speech/transcribe.json)
 * for a 6.5-second clip made with macOS `say`.
 */
const dir = join("tests", "fixtures", "ai", "azure-speech");
const recorded = JSON.parse(
  readFileSync(join(dir, "transcribe.json"), "utf8"),
) as { response: unknown };
const sample = new Uint8Array(readFileSync(join(dir, "transcribe-sample.wav")));

/** The WAV's samples as -1…1 (16-bit mono, after its "data" chunk). */
function wavSamples(bytes: Uint8Array): Float32Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
  let at = 12;
  while (at < bytes.length - 8) {
    const id = String.fromCharCode(...bytes.subarray(at, at + 4));
    const size = view.getUint32(at + 4, true);
    if (id === "data") {
      const samples = new Float32Array(size / 2);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = view.getInt16(at + 8 + i * 2, true) / 32768;
      }
      return samples;
    }
    at += 8 + size;
  }
  throw new Error("no data chunk");
}

describe("Azure speech to text, short audio (D130)", () => {
  it("reads the recorded answer: the words with punctuation, and where", () => {
    const heard = readShortAudio(recorded.response, 6.53);
    expect(heard.text).toBe(
      "Good morning everyone. Today we are going to talk about sleep. Most adults need 7 to 9 hours a night.",
    );
    expect(heard.offset).toBeCloseTo(0.07, 2);
    // Never longer than the piece itself.
    expect(heard.offset + heard.duration).toBeLessThanOrEqual(6.53);
  });

  it("turns the recorded answer into practice sentences", () => {
    const heard = readShortAudio(recorded.response, 6.53);
    const sentences = heardSentences([
      {
        start: heard.offset,
        end: heard.offset + heard.duration,
        text: heard.text,
      },
    ]);
    expect(sentences.map((s) => s.en)).toEqual([
      "Good morning everyone.",
      "Today we are going to talk about sleep.",
      "Most adults need 7 to 9 hours a night.",
    ]);
  });

  it("keeps the sample's quick sentences in one piece, all of it", () => {
    // Its pauses between sentences are 0.2–0.3 s, under a real pause, so
    // it's one piece; the recognizer's punctuation splits the sentences.
    const segments = findSpeechSegments(wavSamples(sample), 16_000);
    expect(segments).toHaveLength(1);
    expect(segments[0].start).toBeLessThan(0.2);
    expect(segments[0].end).toBeGreaterThan(6);
  });

  it("hears nothing in silence and noise, and fails on anything else", () => {
    for (const status of [
      "NoMatch",
      "InitialSilenceTimeout",
      "BabbleTimeout",
    ]) {
      expect(readShortAudio({ RecognitionStatus: status }, 3)).toEqual({
        text: "",
        offset: 0,
        duration: 0,
      });
    }
    expect(() => readShortAudio({ RecognitionStatus: "Error" }, 3)).toThrow(
      ProviderError,
    );
    expect(() => readShortAudio(null, 3)).toThrow(ProviderError);
  });

  it("posts the WAV with the key in a header, never the URL", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify(recorded.response), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const provider = azureTranscriber("secret", "uaenorth", fetchImpl);
    const { value, usage } = await provider.transcribe(sample, 6.53);
    expect(value.text).toContain("talk about sleep");
    expect(usage.costUsd).toBe(0);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe(
      "https://uaenorth.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=simple&profanity=raw",
    );
    expect(String(url)).not.toContain("secret");
    const headers = init?.headers as Record<string, string>;
    expect(headers["ocp-apim-subscription-key"]).toBe("secret");
    expect(headers["content-type"]).toContain("samplerate=16000");
    expect(init?.body).toBe(sample);
  });

  it("treats a used-up free tier (403) as a setup problem, 429 as busy", async () => {
    for (const [status, code] of [
      [403, "config"],
      [429, "busy"],
    ] as const) {
      const provider = azureTranscriber(
        "k",
        "uaenorth",
        async () => new Response("{}", { status }),
      );
      await expect(provider.transcribe(sample, 6.53)).rejects.toMatchObject({
        code,
      });
    }
    expect(() => azureTranscriber("k", "not a region")).toThrow();
  });
});

describe("metered speech to text (D130)", () => {
  const providers = {
    language: fakeLanguage,
    speech: fakeSpeech,
    transcribe: fakeTranscriber,
  };

  it("logs each piece with its length, and what it heard", async () => {
    const meter = { ...memoryMeter(), allowAudio: vi.fn(async () => true) };
    const result = await meteredTranscribe(
      { providers, meter },
      sample,
      4.2,
      2400,
    );
    expect(result).toEqual({
      ok: true,
      value: {
        text: FAKE_HEARD[42 % FAKE_HEARD.length],
        offset: 0,
        duration: 4.2,
      },
    });
    expect(meter.allowAudio).toHaveBeenCalledWith(4200, 2_400_000);
    expect(meter.logs).toEqual([
      expect.objectContaining({
        provider: "fake-stt",
        operation: "transcribe",
        error: null,
        outcome: "heard",
        audioMs: 4200,
        costMicros: 0,
      }),
    ]);
  });

  it("stops at the month's allowance without calling", async () => {
    const transcribe = vi.fn();
    const meter = { ...memoryMeter(), allowAudio: vi.fn(async () => false) };
    const result = await meteredTranscribe(
      {
        providers: { ...providers, transcribe: { id: "x", transcribe } },
        meter,
      },
      sample,
      3,
      null,
    );
    expect(result).toEqual({ ok: false, reason: "limit" });
    expect(transcribe).not.toHaveBeenCalled();
    expect(meter.logs).toEqual([]);
  });

  it("logs a failed call with its length too (the free tier counts it)", async () => {
    const meter = { ...memoryMeter(), allowAudio: vi.fn(async () => true) };
    const result = await meteredTranscribe(
      {
        providers: {
          ...providers,
          transcribe: {
            id: "azure-stt/short-audio/v1",
            transcribe: async () => {
              throw new ProviderError("config", "HTTP 403", undefined, {
                status: 403,
              });
            },
          },
        },
        meter,
      },
      sample,
      2,
      null,
    );
    expect(result).toEqual({ ok: false, reason: "config" });
    expect(meter.logs[0]).toMatchObject({
      error: "config",
      httpStatus: 403,
      audioMs: 2000,
    });
  });

  it("isn't available without speech to text set up", async () => {
    const result = await meteredTranscribe(
      {
        providers: { language: fakeLanguage, speech: fakeSpeech },
        meter: memoryMeter(),
      },
      sample,
      2,
      null,
    );
    expect(result).toEqual({ ok: false, reason: "config" });
  });

  it("keeps half an hour of the free 5 hours spare", () => {
    expect(TRANSCRIBE_MONTHLY_SECONDS).toBe(4.5 * 3600);
  });
});
