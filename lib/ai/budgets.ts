import type { CompositionPrompt } from "@/lib/custom-practice/generation";
import { countChars } from "@/lib/usage";
import { tokenCost, type TokenPrice } from "./pricing";

/**
 * How big each language-model call may get (D38). The cap on output
 * tokens is sent with the request (max_completion_tokens,
 * maxOutputTokens), so a runaway answer stops there, and the worst case
 * is reserved against the daily cost limit before the call.
 */
export type LanguageOperation =
  "translate" | "annotate" | "segment" | "compose";

export type LanguageBudget = {
  operation: LanguageOperation;
  /** Characters of input, not counting the instructions. */
  inputChars: number;
  maxOutputTokens: number;
};

/** About how long the longest instructions are, in characters. */
export const INSTRUCTION_CHARS = 2_000;

const capped = (tokens: number, max: number) =>
  Math.min(max, Math.ceil(tokens));

/** One translation per line, in JSON: about 1.5 tokens per character in. */
export function translateBudget(texts: readonly string[]): LanguageBudget {
  const chars = countChars(texts);
  return {
    operation: "translate",
    inputChars: chars,
    maxOutputTokens: capped(chars * 1.5 + 200, 8_000),
  };
}

/** Up to 2 words and 1 grammar point a sentence, in JSON. */
export function annotateBudget(sentences: readonly string[]): LanguageBudget {
  return {
    operation: "annotate",
    inputChars: countChars(sentences),
    maxOutputTokens: capped(sentences.length * 200 + 300, 6_000),
  };
}

/** The same text back, cut into pieces: about a token per character. */
export function segmentBudget(lines: readonly string[]): LanguageBudget {
  const chars = countChars(lines);
  return {
    operation: "segment",
    inputChars: chars,
    maxOutputTokens: capped(chars + 200, 8_000),
  };
}

/** About 1.3 tokens per English word, with room to spare. */
export function composeBudget(prompt: CompositionPrompt): LanguageBudget {
  return {
    operation: "compose",
    inputChars: countChars([prompt.topic, prompt.scenario, prompt.level]),
    maxOutputTokens: capped(prompt.words * 2 + 300, 3_000),
  };
}

/**
 * The most a call can cost: every input character counted as a token
 * (English averages about 4 per token, so this errs high) plus the whole
 * output cap.
 */
export function maxCost(budget: LanguageBudget, price: TokenPrice): number {
  return tokenCost(
    price,
    budget.inputChars + INSTRUCTION_CHARS,
    budget.maxOutputTokens,
  );
}
