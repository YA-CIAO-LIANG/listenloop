import { describe, expect, it, vi } from "vitest";
import {
  AZURE_SCHEMAS,
  azureEndpoint,
  azureOpenAiLanguage,
} from "@/lib/ai/azure-openai";
import { getAiProviders } from "@/lib/ai/providers";
import { ProviderError } from "@/lib/ai/types";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const completion = (
  value: unknown,
  { finish = "stop", prompt = 100, completion: out = 40 } = {},
) =>
  json(200, {
    choices: [
      {
        finish_reason: finish,
        message: { content: JSON.stringify(value), refusal: null },
      },
    ],
    usage: {
      prompt_tokens: prompt,
      completion_tokens: out,
      completion_tokens_details: { reasoning_tokens: 0 },
    },
  });

const config = {
  endpoint: "https://listenloop-ai.openai.azure.com/",
  apiKey: "secret-key",
  deployment: "gpt-5-mini",
  model: "gpt-5-mini",
};

const sent = (fetchImpl: ReturnType<typeof vi.fn>) => {
  const [url, init] = fetchImpl.mock.calls[0] as unknown as [
    string,
    RequestInit,
  ];
  return {
    url,
    headers: init.headers as Record<string, string>,
    body: JSON.parse(init.body as string),
  };
};

describe("Azure OpenAI", () => {
  it("asks the deployment for strict JSON with a token cap and minimal reasoning", async () => {
    const fetchImpl = vi.fn(async () =>
      completion({ translations: ["Hello."] }),
    );
    const azure = azureOpenAiLanguage(config, fetchImpl);
    const { value, usage } = await azure.translate(["你好。"], {
      from: "zh-Hant",
      to: "en",
    });
    expect(value).toEqual(["Hello."]);
    // gpt-5-mini: US$0.25 in, 2.00 out per million tokens.
    expect(usage).toEqual({
      inputTokens: 100,
      outputTokens: 40,
      chars: 3,
      costUsd: (100 * 0.25 + 40 * 2) / 1e6,
    });
    const { url, headers, body } = sent(fetchImpl);
    expect(url).toBe(
      "https://listenloop-ai.openai.azure.com/openai/v1/chat/completions",
    );
    expect(url).not.toContain("secret-key");
    expect(headers["api-key"]).toBe("secret-key");
    expect(body.model).toBe("gpt-5-mini");
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[1]).toEqual({
      role: "user",
      content: JSON.stringify({ lines: ["你好。"] }),
    });
    expect(body.response_format).toEqual({
      type: "json_schema",
      json_schema: {
        name: "translations",
        strict: true,
        schema: AZURE_SCHEMAS.translations,
      },
    });
    expect(body.max_completion_tokens).toBe(205);
    expect(body.reasoning_effort).toBe("minimal");
    expect(body.temperature).toBeUndefined();
  });

  it("sends a temperature instead to a model that isn't a reasoning model", async () => {
    const fetchImpl = vi.fn(async () => completion({ title: "T", lines: [] }));
    await azureOpenAiLanguage(
      { ...config, deployment: "mini41", model: "gpt-4.1-mini" },
      fetchImpl,
    ).compose({
      topic: "",
      scenario: "s",
      level: "l",
      words: 130,
      format: "monologue",
    });
    const { body } = sent(fetchImpl);
    expect(body.model).toBe("mini41");
    expect(body.temperature).toBe(0.9);
    expect(body.reasoning_effort).toBeUndefined();
  });

  it("returns segments and notes for the checks in notes.ts", async () => {
    const lines = [["Hi there.", "Bye now."]];
    const segments = await azureOpenAiLanguage(
      config,
      vi.fn(async () => completion({ lines })),
    ).segment(["Hi there. Bye now."], "en");
    expect(segments.value).toEqual(lines);

    const notes = { vocab: [], grammar: [] };
    const annotated = await azureOpenAiLanguage(
      config,
      vi.fn(async () => completion(notes)),
    ).annotate(["We moved."]);
    expect(annotated.value).toEqual(notes);
  });

  it("makes every schema strict: all properties required, no others", () => {
    const check = (schema: Record<string, unknown>) => {
      if (schema.type === "object") {
        expect(schema.additionalProperties).toBe(false);
        expect(schema.required).toEqual(
          Object.keys(schema.properties as object),
        );
        for (const child of Object.values(
          schema.properties as Record<string, Record<string, unknown>>,
        )) {
          check(child);
        }
      }
      if (schema.type === "array") {
        check(schema.items as Record<string, unknown>);
      }
    };
    for (const schema of Object.values(AZURE_SCHEMAS)) check(schema);
  });

  it.each([
    ["length", "cut off"],
    ["content_filter", "content filter"],
  ])(
    "fails on finish reason %s, still reporting the tokens",
    async (finish, why) => {
      const azure = azureOpenAiLanguage(
        config,
        vi.fn(async () => completion({}, { finish, completion: 900 })),
      );
      const error = await azure.annotate(["Hi."]).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ProviderError);
      expect(error).toMatchObject({
        code: "failed",
        usage: { inputTokens: 100, outputTokens: 900 },
      });
      expect((error as Error).message).toContain(why);
    },
  );

  it("fails on a refusal or an answer that isn't JSON", async () => {
    const refusal = azureOpenAiLanguage(
      config,
      vi.fn(async () =>
        json(200, {
          choices: [
            {
              finish_reason: "stop",
              message: { content: null, refusal: "No." },
            },
          ],
        }),
      ),
    );
    await expect(refusal.annotate(["Hi."])).rejects.toMatchObject({
      code: "failed",
    });
    const prose = azureOpenAiLanguage(
      config,
      vi.fn(async () =>
        json(200, {
          choices: [{ finish_reason: "stop", message: { content: "Sure!" } }],
        }),
      ),
    );
    await expect(prose.annotate(["Hi."])).rejects.toMatchObject({
      code: "failed",
    });
  });

  it.each([
    [401, {}, "config"],
    [404, { error: { code: "DeploymentNotFound" } }, "config"],
    [400, { error: { code: "content_filter", message: "filtered" } }, "failed"],
    [429, {}, "busy"],
    [500, {}, "failed"],
  ] as const)("maps HTTP %i %j to %s", async (status, body, code) => {
    const azure = azureOpenAiLanguage(
      config,
      vi.fn(async () => json(status, body)),
    );
    await expect(azure.annotate(["Hi."])).rejects.toMatchObject({ code });
  });

  it("accepts only https endpoints on Azure", () => {
    expect(azureEndpoint("https://listenloop-ai.openai.azure.com/")).toBe(
      "https://listenloop-ai.openai.azure.com",
    );
    expect(azureEndpoint("http://listenloop-ai.openai.azure.com")).toBeNull();
    expect(azureEndpoint("https://evil.example.com")).toBeNull();
    expect(azureEndpoint("not a url")).toBeNull();
  });

  it("names the model and prompt version in its id", () => {
    expect(azureOpenAiLanguage(config, vi.fn()).id).toBe(
      "azure-openai/gpt-5-mini/p1",
    );
  });
});

describe("getAiProviders with Azure", () => {
  const azure = {
    AZURE_OPENAI_ENDPOINT: "https://listenloop-ai.openai.azure.com",
    AZURE_OPENAI_API_KEY: "k",
    AZURE_OPENAI_DEPLOYMENT: "gpt-5-mini",
    AZURE_OPENAI_MODEL: "gpt-5-mini",
    AZURE_SPEECH_KEY: "s",
    AZURE_SPEECH_REGION: "uaenorth",
  };

  it("uses Azure for both by default", () => {
    const providers = getAiProviders(azure);
    expect(providers?.language.id).toBe("azure-openai/gpt-5-mini/p1");
    expect(providers?.speech.id).toBe("azure-tts/neural/v1");
  });

  it("can keep Gemini for language", () => {
    expect(
      getAiProviders({
        ...azure,
        AI_LANGUAGE_PROVIDER: "google",
        GEMINI_API_KEY: "g",
      })?.language.id,
    ).toMatch(/^gemini\//);
  });

  it.each([
    ["AZURE_OPENAI_ENDPOINT", ""],
    ["AZURE_OPENAI_ENDPOINT", "https://example.com"],
    ["AZURE_OPENAI_API_KEY", ""],
    ["AZURE_OPENAI_DEPLOYMENT", ""],
    ["AZURE_OPENAI_MODEL", "gpt-9-unpriced"],
  ])("is off when %s is %j", (name, value) => {
    expect(getAiProviders({ ...azure, [name]: value })).toBeNull();
  });
});
