import {
  annotateBudget,
  composeBudget,
  segmentBudget,
  translateBudget,
  type LanguageBudget,
} from "./budgets";
import { postToProvider } from "./http";
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
 * Translation, notes, splitting, and generated text with Azure OpenAI
 * (D40): the v1 chat completions API with strict JSON-schema output, on
 * the deployment named in AZURE_OPENAI_DEPLOYMENT. The model name picks
 * the price (lib/ai/pricing.ts) and the settings below; a model without
 * both isn't used, so no call goes uncounted.
 */
export type AzureOpenAiConfig = {
  /** https://<resource>.openai.azure.com */
  endpoint: string;
  apiKey: string;
  deployment: string;
  /** The deployed model, e.g. "gpt-5-mini". */
  model: string;
};

/**
 * Per model: reasoning models (gpt-5 family) take a reasoning effort and
 * no temperature; the others take a temperature.
 */
export const AZURE_MODEL_SETTINGS: Readonly<
  Record<string, { reasoning: "minimal" } | { temperature: true }>
> = {
  "gpt-5-mini": { reasoning: "minimal" },
  "gpt-4.1-mini": { temperature: true },
};

export function azureModelPrice(model: string): TokenPrice | null {
  return AZURE_MODEL_SETTINGS[model]
    ? (LANGUAGE_PRICES[`azure-openai/${model}`] ?? null)
    : null;
}

/** An https URL on Azure, without a trailing slash; null otherwise. */
export function azureEndpoint(value: string): string | null {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !/\.(openai\.azure\.com|cognitiveservices\.azure\.com|services\.ai\.azure\.com)$/.test(
        url.hostname,
      )
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

const STRING = { type: "string" } as const;
const INDEX = { type: "integer" } as const;
const object = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

/** Strict mode: every property required, nothing else allowed. */
export const AZURE_SCHEMAS = {
  translations: object({ translations: { type: "array", items: STRING } }),
  notes: object({
    vocab: {
      type: "array",
      items: object({
        sentence: INDEX,
        word: STRING,
        pos: STRING,
        zh: STRING,
        example: STRING,
      }),
    },
    grammar: {
      type: "array",
      items: object({
        sentence: INDEX,
        point: STRING,
        explanation: STRING,
        example: STRING,
      }),
    },
  }),
  segments: object({
    lines: { type: "array", items: { type: "array", items: STRING } },
  }),
  composition: object({
    title: STRING,
    lines: { type: "array", items: STRING },
  }),
} as const;

type ChatCompletion = {
  choices?: {
    finish_reason?: string;
    message?: { content?: string | null; refusal?: string | null };
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

/** Tokens from a chat completion (reasoning is part of completion_tokens). */
export function azureUsage(
  response: ChatCompletion,
  price: TokenPrice,
  chars: number,
): CallUsage {
  const inputTokens = response.usage?.prompt_tokens ?? 0;
  const outputTokens = response.usage?.completion_tokens ?? 0;
  return {
    inputTokens,
    outputTokens,
    chars,
    costUsd: tokenCost(price, inputTokens, outputTokens),
  };
}

/** The JSON answer, or a ProviderError that carries what it cost. */
export function completionJson(
  response: ChatCompletion,
  usage: CallUsage,
): unknown {
  const choice = response.choices?.[0];
  const fail = (why: string) =>
    new ProviderError("failed", `Azure OpenAI: ${why}`, usage);
  if (choice?.finish_reason === "length")
    throw fail("cut off at the token cap");
  if (choice?.finish_reason === "content_filter") throw fail("content filter");
  if (choice?.message?.refusal) throw fail("the model refused");
  const text = choice?.message?.content;
  if (!text) throw fail(`empty answer (${choice?.finish_reason ?? "none"})`);
  try {
    return JSON.parse(text);
  } catch {
    throw fail("the answer wasn't JSON");
  }
}

export function azureOpenAiLanguage(
  config: AzureOpenAiConfig,
  fetchImpl: typeof fetch = fetch,
): LanguageProvider {
  const knownPrice = azureModelPrice(config.model);
  const endpoint = azureEndpoint(config.endpoint);
  if (!knownPrice || !endpoint) {
    throw new Error(
      `Azure OpenAI: unsupported model "${config.model}" or endpoint`,
    );
  }
  const price: TokenPrice = knownPrice;
  const settings = AZURE_MODEL_SETTINGS[config.model];
  const url = `${endpoint}/openai/v1/chat/completions`;

  async function generate(
    name: keyof typeof AZURE_SCHEMAS,
    instructions: string,
    input: unknown,
    budget: LanguageBudget,
    temperature = 0.2,
  ): Promise<Billed<unknown>> {
    const response = await postToProvider(
      url,
      {
        headers: {
          "content-type": "application/json",
          "api-key": config.apiKey,
        },
        body: JSON.stringify({
          model: config.deployment,
          messages: [
            { role: "system", content: instructions },
            { role: "user", content: JSON.stringify(input) },
          ],
          response_format: {
            type: "json_schema",
            json_schema: { name, strict: true, schema: AZURE_SCHEMAS[name] },
          },
          max_completion_tokens: budget.maxOutputTokens,
          ...("reasoning" in settings
            ? { reasoning_effort: settings.reasoning }
            : { temperature }),
        }),
      },
      fetchImpl,
      "Azure OpenAI",
    );
    const completion = (await response.json()) as ChatCompletion;
    const usage = azureUsage(completion, price, budget.inputChars);
    return { value: completionJson(completion, usage), usage };
  }

  return {
    id: `azure-openai/${config.model}/p${PROMPT_VERSION}`,
    price,
    async translate(texts, { from, to }) {
      const { value, usage } = await generate(
        "translations",
        TRANSLATE_INSTRUCTIONS(from, to),
        { lines: texts },
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
      // More varied than translation where the model takes a temperature.
      return generate(
        "composition",
        COMPOSE_INSTRUCTIONS,
        prompt,
        composeBudget(prompt),
        0.9,
      );
    },
    async segment(lines, language) {
      const { value, usage } = await generate(
        "segments",
        SEGMENT_INSTRUCTIONS(language),
        { lines },
        segmentBudget(lines),
      );
      return { value: (value as { lines?: unknown }).lines, usage };
    },
    async annotate(sentences) {
      return generate(
        "notes",
        NOTES_INSTRUCTIONS,
        { sentences: sentences.map((en, index) => ({ index, en })) },
        annotateBudget(sentences),
      );
    },
  };
}
