import {
  annotateBudget,
  composeBudget,
  segmentBudget,
  translateBudget,
  type LanguageBudget,
} from "./budgets";
import { postGoogleJson, probeProvider } from "./http";
import { LANGUAGE_PRICES, tokenCost, type TokenPrice } from "./pricing";
import {
  COMPOSE_INSTRUCTIONS,
  NOTES_INSTRUCTIONS,
  PROMPT_VERSION,
  SEGMENT_INSTRUCTIONS,
  TRANSLATE_INSTRUCTIONS,
} from "./prompts";
import {
  ProviderError,
  type Billed,
  type CallUsage,
  type LanguageProvider,
} from "./types";

/**
 * Translation and teaching notes with the Gemini API (D28). Stable model
 * with a free tier, checked 2026-11-03 on aistudio.google.com/docs/models;
 * change it here. The provider id carries the model and prompt version, so
 * changing either makes fresh results instead of reusing the cache.
 */
export const GEMINI_MODEL = "gemini-3.6-flash";

const endpoint = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

const STRING = { type: "STRING" } as const;
const INDEX = { type: "INTEGER" } as const;

const NOTES_SCHEMA = {
  type: "OBJECT",
  properties: {
    vocab: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          sentence: INDEX,
          word: STRING,
          pos: STRING,
          zh: STRING,
          example: STRING,
        },
        required: ["sentence", "word", "pos", "zh", "example"],
      },
    },
    grammar: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          sentence: INDEX,
          point: STRING,
          explanation: STRING,
          example: STRING,
        },
        required: ["sentence", "point", "explanation", "example"],
      },
    },
  },
  required: ["vocab", "grammar"],
} as const;

const SEGMENTS_SCHEMA = {
  type: "OBJECT",
  properties: {
    lines: { type: "ARRAY", items: { type: "ARRAY", items: STRING } },
  },
  required: ["lines"],
} as const;

const COMPOSITION_SCHEMA = {
  type: "OBJECT",
  properties: { title: STRING, lines: { type: "ARRAY", items: STRING } },
  required: ["title", "lines"],
} as const;

const TRANSLATIONS_SCHEMA = {
  type: "OBJECT",
  properties: { translations: { type: "ARRAY", items: STRING } },
  required: ["translations"],
} as const;

/** The JSON a structured-output response carries in its text parts. */
export function responseJson(response: unknown): unknown {
  const candidate = (
    response as {
      candidates?: {
        content?: { parts?: { text?: string }[] };
        finishReason?: string;
      }[];
    }
  ).candidates?.[0];
  const text =
    candidate?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  if (!text) {
    throw new ProviderError(
      "failed",
      `Gemini: empty response (${candidate?.finishReason ?? "no candidate"})`,
    );
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new ProviderError("failed", "Gemini: the response wasn't JSON");
  }
}

/**
 * Tokens from a response's usageMetadata (thinking counts as output) and
 * their cost; zeros when it's missing.
 */
export function geminiUsage(
  response: unknown,
  price: TokenPrice,
  chars: number,
): CallUsage {
  const meta =
    (
      response as {
        usageMetadata?: {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
          thoughtsTokenCount?: number;
        };
      }
    ).usageMetadata ?? {};
  const inputTokens = meta.promptTokenCount ?? 0;
  const outputTokens =
    (meta.candidatesTokenCount ?? 0) + (meta.thoughtsTokenCount ?? 0);
  return {
    inputTokens,
    outputTokens,
    chars,
    costUsd: tokenCost(price, inputTokens, outputTokens),
  };
}

export function geminiLanguage(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
  model: string = GEMINI_MODEL,
): LanguageProvider {
  const price = LANGUAGE_PRICES[`gemini/${model}`] ?? {
    inputPerM: 0,
    outputPerM: 0,
  };

  async function generate(
    instructions: string,
    input: unknown,
    schema: unknown,
    budget: LanguageBudget,
    temperature = 0.2,
  ): Promise<Billed<unknown>> {
    const response = await postGoogleJson(
      endpoint(model),
      apiKey,
      {
        systemInstruction: { parts: [{ text: instructions }] },
        contents: [{ role: "user", parts: [{ text: JSON.stringify(input) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schema,
          temperature,
          maxOutputTokens: budget.maxOutputTokens,
        },
      },
      fetchImpl,
      "Gemini",
    );
    const usage = geminiUsage(response, price, budget.inputChars);
    try {
      return { value: responseJson(response), usage };
    } catch (error) {
      // Tokens spent on an unusable answer are still paid for.
      if (error instanceof ProviderError) {
        throw new ProviderError(error.code, error.message, usage, error.detail);
      }
      throw error;
    }
  }

  return {
    id: `gemini/${model}/p${PROMPT_VERSION}`,
    // Reading the model's details is free and needs the same key (D49).
    checkConnection: () =>
      probeProvider(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}`,
        { method: "GET", headers: { "x-goog-api-key": apiKey } },
        fetchImpl,
        (status) => status === 200,
      ),
    price,
    async translate(texts, { from, to }) {
      const { value, usage } = await generate(
        TRANSLATE_INSTRUCTIONS(from, to),
        { lines: texts },
        TRANSLATIONS_SCHEMA,
        translateBudget(texts),
      );
      const result = value as { translations?: unknown };
      // The caller checks the count and contents (translateCached).
      return {
        value: Array.isArray(result.translations)
          ? (result.translations as string[])
          : [],
        usage,
      };
    },
    async compose(prompt) {
      // More varied than translation: every request should read fresh.
      return generate(
        COMPOSE_INSTRUCTIONS,
        prompt,
        COMPOSITION_SCHEMA,
        composeBudget(prompt),
        0.9,
      );
    },
    async segment(lines, language) {
      const { value, usage } = await generate(
        SEGMENT_INSTRUCTIONS(language),
        { lines },
        SEGMENTS_SCHEMA,
        segmentBudget(lines),
      );
      return { value: (value as { lines?: unknown }).lines, usage };
    },
    async annotate(sentences) {
      return generate(
        NOTES_INSTRUCTIONS,
        { sentences: sentences.map((en, index) => ({ index, en })) },
        NOTES_SCHEMA,
        annotateBudget(sentences),
      );
    },
  };
}
