import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { azureOpenAiLanguage } from "@/lib/ai/azure-openai";
import { azureSpeech } from "@/lib/ai/azure-speech";
import {
  checkGeneratedText,
  GENERATION_LEVELS,
} from "@/lib/custom-practice/generation";
import { cleanNotes } from "@/lib/custom-practice/notes";
import { checkedSegments } from "@/lib/custom-practice/split";

/**
 * Replays the real answers recorded once by `npm run ai:record`
 * (tests/fixtures/ai/, D41), so the parsing is tested against what Azure
 * really sends, without calling it again. If a request test fails, the
 * prompt or settings changed since recording: re-record only with Joe's
 * go-ahead (CLAUDE.md, "AI 供應者與測試").
 */
const dir = join("tests", "fixtures", "ai");
const fixture = (name: string) =>
  JSON.parse(readFileSync(join(dir, name), "utf8")) as {
    request: Record<string, unknown>;
    response: unknown;
  };

const config = {
  endpoint: "https://listenloop-ai.openai.azure.com",
  apiKey: "k",
  deployment: "gpt-5-mini",
  model: "gpt-5-mini",
};

/** A fetch that answers with the recorded response and keeps the request. */
function replay(name: string) {
  const recorded = fixture(name);
  const fetchImpl = vi.fn<typeof fetch>(
    async () =>
      new Response(JSON.stringify(recorded.response), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
  const sent = () =>
    JSON.parse(fetchImpl.mock.calls[0][1]?.body as string) as unknown;
  return { recorded, fetchImpl, sent };
}

describe("recorded Azure OpenAI answers", () => {
  it("translates into a line translateCached keeps", async () => {
    const { recorded, fetchImpl, sent } = replay("azure-openai/translate.json");
    const { value, usage } = await azureOpenAiLanguage(
      config,
      fetchImpl,
    ).translate(["你好，很高興認識你。"], { from: "zh-Hant", to: "en" });
    expect(value).toHaveLength(1);
    expect(value[0]).toMatch(/nice to meet you/i);
    expect(usage.inputTokens).toBeGreaterThan(0);
    expect(usage.costUsd).toBeGreaterThan(0);
    expect(sent()).toEqual(recorded.request);
  });

  it("writes notes that pass cleanNotes", async () => {
    const { recorded, fetchImpl, sent } = replay("azure-openai/annotate.json");
    const { value } = await azureOpenAiLanguage(config, fetchImpl).annotate([
      "Nice to meet you, too.",
    ]);
    const notes = cleanNotes(value, 1);
    expect(notes.vocab.length + notes.grammar.length).toBeGreaterThan(0);
    expect(sent()).toEqual(recorded.request);
  });

  it("splits only by cutting, as checkedSegments requires", async () => {
    const lines = ["I missed the bus. So I walked to school."];
    const { recorded, fetchImpl, sent } = replay("azure-openai/segment.json");
    const { value } = await azureOpenAiLanguage(config, fetchImpl).segment(
      lines,
      "en",
    );
    expect(checkedSegments(lines, value, "en")).toEqual([
      "I missed the bus.",
      "So I walked to school.",
    ]);
    expect(sent()).toEqual(recorded.request);
  });

  it("composes text that checkGeneratedText accepts", async () => {
    const { recorded, fetchImpl, sent } = replay("azure-openai/compose.json");
    const { value } = await azureOpenAiLanguage(config, fetchImpl).compose({
      topic: "",
      scenario: "ordering a drink at a coffee shop",
      level: GENERATION_LEVELS.beginner,
      words: 40,
      format: "dialogue",
    });
    const text = checkGeneratedText(value, 40);
    expect(text?.title).toBeTruthy();
    expect(text?.text.split("\n").length).toBeGreaterThan(2);
    expect(sent()).toEqual(recorded.request);
  });
});

describe("recorded Azure Speech audio", () => {
  it("comes back as the MP3 Azure sent", async () => {
    const mp3 = readFileSync(join(dir, "azure-speech", "us-female.mp3"));
    const { request } = fixture("azure-speech/us-female.json");
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(new Uint8Array(mp3), {
          status: 200,
          headers: { "content-type": "audio/mpeg" },
        }),
    );
    const { value, usage } = await azureSpeech(
      "k",
      "uaenorth",
      fetchImpl,
    ).synthesize("Nice to meet you.", { accent: "us", gender: "female" });
    expect(value.data.length).toBe(mp3.length);
    // An MP3 starts with an ID3 tag or an MPEG frame sync.
    expect(
      value.data[0] === 0xff || mp3.subarray(0, 3).toString() === "ID3",
    ).toBe(true);
    expect(usage.chars).toBe(17);
    expect(fetchImpl.mock.calls[0][1]?.body).toBe(request);
  });
});
