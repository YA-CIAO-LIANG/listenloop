import { subtitleFromModel } from "@/lib/custom-practice/subtitle";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { azureOpenAiLanguage } from "@/lib/ai/azure-openai";
import { azureSpeech } from "@/lib/ai/azure-speech";
import { ProviderError } from "@/lib/ai/types";
import { checkGeneratedText } from "@/lib/custom-practice/generation";
import { LEVEL_PROMPTS } from "@/lib/categories";
import { richNotesFromModel } from "@/lib/custom-practice/notes";
import { checkRevision } from "@/lib/custom-practice/revise";
import { checkedSegments } from "@/lib/custom-practice/split";

/**
 * Replays the real answers recorded once by `npm run ai:record`
 * (tests/fixtures/ai/, D41), so the parsing is tested against what Azure
 * really sends, without calling it again. If a request test fails, the
 * prompt or settings changed since recording: re-record only with Joe's
 * go-ahead (CLAUDE.md, "AI 供應者與測試").
 *
 * Notes, splitting, composing, and revising are graded by the AI eval
 * (D150), whose recordings are checked against the current prompts; here
 * their older answers only test the parsing, so their requests aren't
 * compared (D153: comparing them would mean paying to record the same
 * prompts twice).
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

  it("writes version 2 notes that pass cleanRichNotes (D67)", async () => {
    const sentence =
      "If you're going to the library later, could you pick up the book I reserved for my history class?";
    const { fetchImpl } = replay("azure-openai/annotate.json");
    const { value } = await azureOpenAiLanguage(config, fetchImpl).annotate([
      sentence,
    ]);
    const [notes] = richNotesFromModel(value, [sentence]);
    // A real answer: check its shape, not the model's wording.
    expect(["medium", "hard"]).toContain(notes.difficulty);
    expect(notes.highlights.length).toBeGreaterThan(0);
    expect(notes.vocab.length).toBeGreaterThan(0);
    for (const item of notes.vocab) {
      expect(item.ipa).toMatch(/^\/.+\/$/);
      expect(item.examples[0].zh).toBeTruthy();
    }
    if (notes.difficulty === "hard") {
      expect(notes.chunks.length).toBeGreaterThanOrEqual(2);
    }
    // The prompt is checked by the eval's recordings (D153).
  });

  it("writes a subtitle that passes subtitleFromModel (D71)", async () => {
    const { recorded, fetchImpl, sent } = replay("azure-openai/describe.json");
    const input = (recorded.request as { messages: { content: string }[] })
      .messages[1].content;
    const { value } = await azureOpenAiLanguage(config, fetchImpl).describe(
      JSON.parse(input),
    );
    const subtitle = subtitleFromModel(value);
    expect(subtitle).toBeTruthy();
    expect([...subtitle!].length).toBeLessThanOrEqual(30);
    const titles = value as { titleEn?: string; titleZh?: string };
    expect(titles.titleEn).toMatch(/[A-Za-z]/);
    expect(titles.titleZh).toMatch(/\p{Script=Han}/u);
    expect(sent()).toEqual(recorded.request);
  });

  it("splits only by cutting, as checkedSegments requires", async () => {
    const lines = ["I missed the bus. So I walked to school."];
    const { fetchImpl } = replay("azure-openai/segment.json");
    const { value } = await azureOpenAiLanguage(config, fetchImpl).segment(
      lines,
      "en",
    );
    expect(checkedSegments(lines, value, "en")).toEqual([
      "I missed the bus.",
      "So I walked to school.",
    ]);
    // The prompt is checked by the eval's recordings (D153).
  });

  it("composes text that checkGeneratedText accepts", async () => {
    const { fetchImpl } = replay("azure-openai/compose.json");
    const { value } = await azureOpenAiLanguage(config, fetchImpl).compose({
      topic: "",
      scenario: "ordering a drink at a coffee shop",
      level: LEVEL_PROMPTS.beginner,
      words: 40,
      format: "dialogue",
    });
    const text = checkGeneratedText(value, 40);
    expect(text?.title).toBeTruthy();
    // Both titles and the subtitle come in the same call (D83).
    expect(text?.titleZh).toMatch(/\p{Script=Han}/u);
    expect(text?.subtitle).toMatch(/\p{Script=Han}/u);
    expect(text?.text.split("\n").length).toBeGreaterThan(2);
    // The prompt is checked by the eval's recordings (D153).
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

describe("Azure OpenAI failures in the usage log (D49)", () => {
  it("keeps the status and Azure's error code, not the message", async () => {
    // Azure's documented error body for a deployment name that doesn't exist.
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            error: {
              code: "DeploymentNotFound",
              message: "The API deployment for this resource does not exist.",
            },
          }),
          { status: 404, headers: { "content-type": "application/json" } },
        ),
    );
    const error = await azureOpenAiLanguage(config, fetchImpl)
      .segment(["One. Two."], "en")
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect(error).toMatchObject({
      code: "config",
      detail: { status: 404, code: "DeploymentNotFound" },
    });
  });

  it("names a timeout", async () => {
    const timeout = new DOMException(
      "The operation timed out.",
      "TimeoutError",
    );
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(timeout);
    const error = await azureOpenAiLanguage(config, fetchImpl)
      .segment(["One. Two."], "en")
      .catch((e: unknown) => e);
    expect(error).toMatchObject({
      code: "failed",
      detail: { code: "timeout" },
    });
  });
});

describe("revise with an instruction, recorded (D123)", () => {
  // The 7 sentences and "改成恐怖風" sent in both recordings.
  const sentInput = (name: string) => {
    const messages = fixture(name).request.messages as { content: string }[];
    return JSON.parse(messages[1].content) as {
      lines: string[];
      instruction: string;
      format: "monologue" | "dialogue";
    };
  };

  it("rewrites the whole text in a horror style from a Chinese instruction, with one more sentence", async () => {
    const input = sentInput("azure-openai/revise.json");
    expect(input.instruction).toBe("改成恐怖風");
    const { fetchImpl } = replay("azure-openai/revise.json");
    const { value, usage } = await azureOpenAiLanguage(
      config,
      fetchImpl,
    ).revise(input);
    // The prompt is checked by the eval's recordings (D153).
    const revision = checkRevision(value, input.lines);
    expect(revision?.status).toBe("changed");
    const lines = revision?.status === "changed" ? revision.lines : [];
    // A style changes every sentence, and may change how many there are.
    expect(lines).toHaveLength(input.lines.length + 1);
    expect(lines.filter((line) => input.lines.includes(line))).toEqual([]);
    expect(usage.costUsd).toBeGreaterThan(0);
  });

  it("parses the D96 answer, which had no status, by its lines", () => {
    const input = sentInput("azure-openai/revise-d96.json");
    const response = fixture("azure-openai/revise-d96.json").response as {
      choices: { message: { content: string } }[];
    };
    const answer = JSON.parse(response.choices[0].message.content);
    expect(checkRevision(answer, input.lines)?.status).toBe("changed");
    // The production calls answered with the lines unchanged.
    expect(checkRevision({ lines: input.lines }, input.lines)).toEqual({
      status: "unchanged",
      reason: "",
    });
  });
});
