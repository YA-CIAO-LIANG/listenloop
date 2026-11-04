import { postGoogleJson } from "./http";
import {
  ProviderError,
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

export function geminiLanguage(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
  model: string = GEMINI_MODEL,
): LanguageProvider {
  async function generate(
    instructions: string,
    input: unknown,
    schema: unknown,
  ) {
    const response = await postGoogleJson(
      endpoint(model),
      apiKey,
      {
        systemInstruction: { parts: [{ text: instructions }] },
        contents: [{ role: "user", parts: [{ text: JSON.stringify(input) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schema,
          temperature: 0.2,
        },
      },
      fetchImpl,
      "Gemini",
    );
    return responseJson(response);
  }

  return {
    id: `gemini/${model}/p${GEMINI_PROMPT_VERSION}`,
    async translate(texts, { from, to }) {
      const result = (await generate(
        TRANSLATE_INSTRUCTIONS(from, to),
        { lines: texts },
        TRANSLATIONS_SCHEMA,
      )) as { translations?: unknown };
      // The caller checks the count and contents (translateCached).
      return Array.isArray(result.translations)
        ? (result.translations as string[])
        : [];
    },
    async annotate(sentences) {
      return generate(
        NOTES_INSTRUCTIONS,
        { sentences: sentences.map((en, index) => ({ index, en })) },
        NOTES_SCHEMA,
      );
    },
  };
}
