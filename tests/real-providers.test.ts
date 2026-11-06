import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { GEMINI_MODEL, geminiLanguage } from "@/lib/ai/gemini";
import { azureSpeech, isAzureRegion } from "@/lib/ai/azure-speech";
import { googleSpeech } from "@/lib/ai/google-tts";
import { getAiProviders } from "@/lib/ai/providers";
import {
  ProviderError,
  VOICE_ACCENTS,
  VOICE_GENDERS,
  voiceId,
} from "@/lib/ai/types";
import { AZURE_VOICES, GOOGLE_VOICES } from "@/lib/ai/voices";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const geminiReply = (value: unknown) =>
  json(200, {
    candidates: [
      {
        content: { parts: [{ text: JSON.stringify(value) }] },
        finishReason: "STOP",
      },
    ],
  });

describe("Gemini", () => {
  it("asks for structured JSON with the key in a header", async () => {
    const fetchImpl = vi.fn(async () =>
      geminiReply({ translations: ["Hello."] }),
    );
    const gemini = geminiLanguage("secret-key", fetchImpl);
    expect(
      await gemini.translate(["你好。"], { from: "zh-Hant", to: "en" }),
    ).toMatchObject({ value: ["Hello."] });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    );
    expect(url).not.toContain("secret-key");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe(
      "secret-key",
    );
    const body = JSON.parse(init.body as string);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    // The output cap from lib/ai/budgets.ts: 3 characters × 1.5 + 200.
    expect(body.generationConfig.maxOutputTokens).toBe(205);
    expect(body.contents[0].parts[0].text).toBe(
      JSON.stringify({ lines: ["你好。"] }),
    );
  });

  it("asks for sentences per line and returns them for split.ts to check", async () => {
    const lines = [["Hi there.", "Bye now."]];
    const fetchImpl = vi.fn(async () => geminiReply({ lines }));
    const gemini = geminiLanguage("secret-key", fetchImpl);
    expect((await gemini.segment(["Hi there. Bye now."], "en")).value).toEqual(
      lines,
    );
    const [, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(init.body as string);
    expect(body.contents[0].parts[0].text).toBe(
      JSON.stringify({ lines: ["Hi there. Bye now."] }),
    );
    expect(body.systemInstruction.parts[0].text).toContain("Only cut");
  });

  it("returns the notes JSON as is, for notes.ts to check", async () => {
    const notes = { vocab: [{ sentence: 0, word: "move" }], grammar: [] };
    const gemini = geminiLanguage(
      "k",
      vi.fn(async () => geminiReply(notes)),
    );
    expect((await gemini.annotate(["We moved."])).value).toEqual(notes);
  });

  it("reports tokens, thinking included, and their estimated cost", async () => {
    const gemini = geminiLanguage(
      "k",
      vi.fn(async () =>
        json(200, {
          candidates: [
            { content: { parts: [{ text: "{}" }] }, finishReason: "STOP" },
          ],
          usageMetadata: {
            promptTokenCount: 1_000,
            candidatesTokenCount: 300,
            thoughtsTokenCount: 200,
          },
        }),
      ),
    );
    const { usage } = await gemini.annotate(["We moved."]);
    expect(usage).toEqual({
      inputTokens: 1_000,
      outputTokens: 500,
      chars: 9,
      // gemini-3.6-flash: US$0.75 in, 3.75 out per million.
      costUsd: (1_000 * 0.75 + 500 * 3.75) / 1e6,
    });
  });

  it("still reports the usage of an answer it can't use", async () => {
    const gemini = geminiLanguage(
      "k",
      vi.fn(async () =>
        json(200, {
          candidates: [{ content: { parts: [{ text: "Sure! Here" }] } }],
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
        }),
      ),
    );
    await expect(gemini.annotate(["Hi."])).rejects.toMatchObject({
      code: "failed",
      usage: { inputTokens: 10, outputTokens: 5 },
    });
  });

  it("names the model and prompt version in its id", () => {
    expect(geminiLanguage("k", vi.fn()).id).toBe(`gemini/${GEMINI_MODEL}/p1`);
  });

  it.each([
    [429, "busy"],
    [503, "busy"],
    [403, "config"],
    [404, "config"],
    [500, "failed"],
  ] as const)("maps HTTP %i to %s", async (status, code) => {
    const gemini = geminiLanguage(
      "k",
      vi.fn(async () => json(status, { error: { message: "nope" } })),
    );
    await expect(gemini.annotate(["Hi."])).rejects.toMatchObject({ code });
  });

  it("fails on an empty, blocked, or non-JSON response", async () => {
    const empty = geminiLanguage(
      "k",
      vi.fn(async () =>
        json(200, { candidates: [{ finishReason: "SAFETY" }] }),
      ),
    );
    await expect(empty.annotate(["Hi."])).rejects.toThrow(/SAFETY/);
    const prose = geminiLanguage(
      "k",
      vi.fn(async () =>
        json(200, {
          candidates: [{ content: { parts: [{ text: "Sure! Here" }] } }],
        }),
      ),
    );
    await expect(prose.annotate(["Hi."])).rejects.toBeInstanceOf(ProviderError);
  });

  it("fails cleanly when the network does", async () => {
    const gemini = geminiLanguage(
      "k",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    await expect(gemini.annotate(["Hi."])).rejects.toMatchObject({
      code: "failed",
    });
  });
});

describe("Cloud Text-to-Speech", () => {
  it("asks for MP3 in the mapped Chirp 3 HD voice and decodes it", async () => {
    const fetchImpl = vi.fn(async () =>
      json(200, {
        audioContent: Buffer.from("ID3 fake mp3").toString("base64"),
      }),
    );
    const { value: audio, usage } = await googleSpeech(
      "k",
      fetchImpl,
    ).synthesize("Hello.", {
      accent: "in",
      gender: "male",
    });
    expect(new TextDecoder().decode(audio.data)).toBe("ID3 fake mp3");
    expect(audio.mimeType).toBe("audio/mpeg");
    // Logged at the price past the free tier, so the estimate errs high.
    expect(usage).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      chars: 6,
      costUsd: (6 * 30) / 1e6,
    });
    const body = JSON.parse(
      (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1]
        .body as string,
    );
    expect(body).toEqual({
      input: { text: "Hello." },
      voice: { languageCode: "en-IN", name: "en-IN-Chirp3-HD-Charon" },
      audioConfig: { audioEncoding: "MP3" },
    });
  });

  it("fails without audio in the response", async () => {
    const tts = googleSpeech(
      "k",
      vi.fn(async () => json(200, {})),
    );
    await expect(
      tts.synthesize("Hi.", { accent: "us", gender: "female" }),
    ).rejects.toThrow();
  });

  it("uses a Chirp 3 HD voice of the right accent for every choice", () => {
    for (const accent of VOICE_ACCENTS) {
      for (const gender of VOICE_GENDERS) {
        const voice =
          GOOGLE_VOICES[
            voiceId({ accent, gender }) as keyof typeof GOOGLE_VOICES
          ];
        const locale = { us: "en-US", gb: "en-GB", au: "en-AU", in: "en-IN" }[
          accent
        ];
        expect(voice.languageCode).toBe(locale);
        expect(voice.name).toBe(
          `${locale}-Chirp3-HD-${gender === "female" ? "Kore" : "Charon"}`,
        );
      }
    }
  });
});

describe("voice samples", () => {
  it("has an MP3 sample for every voice card", () => {
    for (const id of Object.keys(AZURE_VOICES)) {
      const file = readFileSync(join("public", "voices", `${id}.mp3`));
      // An MP3 starts with an ID3 tag or an MPEG frame sync.
      const id3 = file.subarray(0, 3).toString("latin1") === "ID3";
      const frame = file[0] === 0xff && (file[1] & 0xe0) === 0xe0;
      expect(id3 || frame).toBe(true);
    }
  });
});

describe("getAiProviders with real keys", () => {
  const google = { GEMINI_API_KEY: "g", GOOGLE_CLOUD_API_KEY: "c" };
  const azureSpeechKeys = {
    AZURE_SPEECH_KEY: "s",
    AZURE_SPEECH_REGION: "uaenorth",
  };

  it("uses Gemini and Azure Speech by default", () => {
    const providers = getAiProviders({ ...google, ...azureSpeechKeys });
    expect(providers?.language.id).toBe(`gemini/${GEMINI_MODEL}/p1`);
    expect(providers?.speech.id).toBe("azure-tts/neural/v1");
  });

  it("can switch speech back to Cloud TTS", () => {
    const providers = getAiProviders({
      ...google,
      AI_SPEECH_PROVIDER: "google",
    });
    expect(providers?.speech.id).toBe("google-tts/chirp3-hd/v1");
  });

  it("is off with a key, region, or provider missing or wrong", () => {
    expect(getAiProviders(google)).toBeNull();
    expect(getAiProviders(azureSpeechKeys)).toBeNull();
    expect(getAiProviders({ ...google, AZURE_SPEECH_KEY: "s" })).toBeNull();
    expect(
      getAiProviders({
        ...google,
        ...azureSpeechKeys,
        AZURE_SPEECH_REGION: "uae north/../x",
      }),
    ).toBeNull();
    expect(
      getAiProviders({
        ...google,
        ...azureSpeechKeys,
        AI_SPEECH_PROVIDER: "azur",
      }),
    ).toBeNull();
    expect(
      getAiProviders({ ...google, AI_LANGUAGE_PROVIDER: "openai" }),
    ).toBeNull();
  });

  it("lets AI_PROVIDERS=fake override the keys, except in production", () => {
    const keys = { ...google, ...azureSpeechKeys, AI_PROVIDERS: "fake" };
    expect(getAiProviders(keys)?.language.id).toBe("fake");
    expect(getAiProviders({ ...keys, VERCEL_ENV: "production" })).toBeNull();
  });
});

describe("Azure Speech", () => {
  const audio = (bytes: number[]) =>
    new Response(new Uint8Array(bytes), {
      status: 200,
      headers: { "content-type": "audio/mpeg" },
    });

  it("posts escaped SSML in the mapped voice and returns the MP3", async () => {
    const fetchImpl = vi.fn(async () => audio([0xff, 0xf3, 1, 2]));
    const { value, usage } = await azureSpeech(
      "secret-key",
      "uaenorth",
      fetchImpl,
    ).synthesize(`Tom & "Ann" <said> it's 5 > 3.`, {
      accent: "au",
      gender: "female",
    });
    expect([...value.data]).toEqual([0xff, 0xf3, 1, 2]);
    expect(value.mimeType).toBe("audio/mpeg");
    // F0 is free; the characters are what the free tier counts.
    expect(usage).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      chars: 30,
      costUsd: 0,
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      "https://uaenorth.tts.speech.microsoft.com/cognitiveservices/v1",
    );
    expect(url).not.toContain("secret-key");
    const headers = init.headers as Record<string, string>;
    expect(headers["ocp-apim-subscription-key"]).toBe("secret-key");
    expect(headers["x-microsoft-outputformat"]).toBe(
      "audio-24khz-48kbitrate-mono-mp3",
    );
    expect(init.body).toBe(
      '<speak version="1.0" xml:lang="en-AU"><voice name="en-AU-NatashaNeural">Tom &amp; &quot;Ann&quot; &lt;said&gt; it&apos;s 5 &gt; 3.</voice></speak>',
    );
  });

  it("refuses a region that isn't one", () => {
    expect(() => azureSpeech("k", "evil.example.com/x")).toThrow();
    expect(isAzureRegion("uaenorth")).toBe(true);
  });

  it.each([
    [401, "config"],
    [403, "config"],
    [429, "busy"],
    [500, "failed"],
  ] as const)("maps HTTP %i to %s", async (status, code) => {
    const tts = azureSpeech(
      "k",
      "uaenorth",
      vi.fn(async () => new Response("", { status })),
    );
    await expect(
      tts.synthesize("Hi.", { accent: "us", gender: "male" }),
    ).rejects.toMatchObject({ code });
  });

  it("fails on an empty answer", async () => {
    const tts = azureSpeech(
      "k",
      "uaenorth",
      vi.fn(async () => audio([])),
    );
    await expect(
      tts.synthesize("Hi.", { accent: "us", gender: "male" }),
    ).rejects.toMatchObject({ code: "failed" });
  });

  it("uses a GA neural voice of the right accent for every choice", () => {
    for (const accent of VOICE_ACCENTS) {
      for (const gender of VOICE_GENDERS) {
        const voice =
          AZURE_VOICES[
            voiceId({ accent, gender }) as keyof typeof AZURE_VOICES
          ];
        const locale = { us: "en-US", gb: "en-GB", au: "en-AU", in: "en-IN" }[
          accent
        ];
        expect(voice.locale).toBe(locale);
        expect(voice.name).toMatch(new RegExp(`^${locale}-[A-Z][a-z]+Neural$`));
      }
    }
  });
});
