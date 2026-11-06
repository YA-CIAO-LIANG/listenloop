import {
  annotateBudget,
  composeBudget,
  segmentBudget,
  translateBudget,
  type LanguageBudget,
} from "./budgets";
import { postGoogleJson } from "./http";
import { LANGUAGE_PRICES, tokenCost, type TokenPrice } from "./pricing";
import {
  ProviderError,
  type Billed,
  type CallUsage,
  type LanguageProvider,
  type TextLanguage,
} from "./types";

/**
 * Translation and teaching notes with the Gemini API (D28). Stable model
 * with a free tier, checked 2026-11-03 on aistudio.google.com/docs/models;
 * change it here. The provider id carries the model and prompt version, so
 * changing either makes fresh results instead of reusing the cache.
 */
export const GEMINI_MODEL = "gemini-3.6-flash";
export const GEMINI_PROMPT_VERSION = 1;

const endpoint = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

const LANGUAGE_NAMES: Record<TextLanguage, string> = {
  en: "English",
  "zh-Hant": "Traditional Chinese as written in Taiwan (臺灣用語)",
};

const TRANSLATE_INSTRUCTIONS = (from: TextLanguage, to: TextLanguage) =>
  [
    `Translate each ${LANGUAGE_NAMES[from]} line into ${LANGUAGE_NAMES[to]}.`,
    "The lines are sentences of one text that a Taiwanese student will use to practice English listening.",
    "Translate every line on its own, in order, one translation per line; never merge, split, or skip lines.",
    "Keep the meaning and tone. Write natural, everyday language, not word-for-word.",
    to === "en"
      ? "Use simple, clear English a learner can dictate: common words, standard spelling, no abbreviations."
      : "Use Taiwanese usage and full-width punctuation.",
  ].join("\n");

const NOTES_INSTRUCTIONS = [
  "You write study notes for Taiwanese students (high school or university, around CEFR B1) practicing English listening with these sentences.",
  "For each sentence, choose 0 to 2 vocabulary items (a word or a short phrase) most worth learning; skip very basic words.",
  "For each item give: the sentence index (0-based), the word as it is best learned (base form for verbs), its part of speech (n., v., adj., adv., prep., phr., …), a short meaning in Traditional Chinese as used in Taiwan, and a NEW short English example sentence (not the original sentence).",
  "Choose 0 or 1 grammar point per sentence, only when the sentence shows a pattern worth teaching; about one grammar point for every three sentences overall.",
  'For each grammar point give: the sentence index, the pattern in short English form (e.g. "be a fool for + V-ing"), an explanation in Traditional Chinese as used in Taiwan (one or two sentences), and a NEW short English example sentence.',
  "Do not repeat the same word or grammar point.",
].join("\n");

const SEGMENT_INSTRUCTIONS = (language: "en" | "zh") =>
  [
    `You split ${language === "zh" ? "Chinese" : "English"} text into sentences for dictation practice: a Taiwanese student hears each one, then types it.`,
    "The input is a list of lines. For each line, in order, return the list of pieces it splits into. Never join text from different lines.",
    "Only cut: every piece is an exact, consecutive part of its line. Never change, add, remove, fix, or reorder any character; the pieces of a line joined together must be that line.",
    'Cut where a sentence ends by meaning. Never cut inside an abbreviation (Dr., Mr., U.S., a.m., e.g., i.e., Ph.D., No. 5), a number, time, or amount (9:30, 3.5, $1,000, 90%), a quotation (keep a quote with the words that introduce it, like: He said, "Stop!"), or a name.',
    language === "zh"
      ? "Aim for pieces whose English translation would be about 5 to 25 words. Cut a long sentence at a natural clause boundary (，；：) only when each part is a complete thought."
      : "Aim for pieces of about 5 to 25 words. Cut a sentence longer than 25 words at a natural clause boundary (; or a comma before and, but, so, because, which…) so each part still reads as a complete thought. A short sentence may stay short; you may keep a very short sentence together with the next one in the same line when they belong together.",
    'Example: ["Dr. Smith arrived at 9:30 a.m. in the U.S. He said, \"It\'s 90% done.\" Then he left."] → [["Dr. Smith arrived at 9:30 a.m. in the U.S.", "He said, \"It\'s 90% done.\" Then he left."]]',
  ].join("\n");

const COMPOSE_INSTRUCTIONS = [
  "You write original English listening practice texts for Taiwanese students (high school or university). Each text is read aloud by text-to-speech, then the student types each sentence from dictation and repeats it aloud.",
  "Write natural, spoken English with correct standard spelling. Give the text a short English title.",
  "Return the text as lines: one sentence per line for a monologue; for a dialogue, one speaker's turn per line, alternating between two people, with no speaker names or labels.",
  "Keep each sentence about 5 to 25 words. Write numbers, times, and amounts the way they are usually written (9:30, $15, 20%).",
  "Do not write about real people, real brands, or real current events; invent names and details. Keep it appropriate for students.",
  "Match the requested level, length (in words), and format. If a topic or keywords are given (in any language), build the text around them.",
].join("\n");

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
        throw new ProviderError(error.code, error.message, usage);
      }
      throw error;
    }
  }

  return {
    id: `gemini/${model}/p${GEMINI_PROMPT_VERSION}`,
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
