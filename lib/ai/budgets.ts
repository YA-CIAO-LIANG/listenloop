import type { CompositionPrompt } from "@/lib/custom-practice/generation";
import { countChars } from "@/lib/usage";
import { tokenCost, type TokenPrice } from "./pricing";
import type {
  AuditInput,
  DescribeInput,
  NewsInput,
  RevisionInput,
} from "./types";

/**
 * How big each language-model call may get (D38). The cap on output
 * tokens is sent with the request (max_completion_tokens,
 * maxOutputTokens), so a runaway answer stops there, and the worst case
 * is reserved against the daily cost limit before the call.
 */
export type LanguageOperation =
  | "translate"
  | "annotate"
  | "segment"
  | "compose"
  | "describe"
  | "revise"
  | "news"
  | "audit"
  | "writing"
  | "chat"
  | "back-check";

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

/**
 * Version 2 notes (D67), in JSON: about 200 tokens for an easy sentence
 * and up to about 800 for a hard one. 700 a sentence cut a real answer
 * off (2026-11-08, D69), so 1,000 a sentence plus 600, at most 8,000.
 */
export function annotateBudget(sentences: readonly string[]): LanguageBudget {
  return {
    operation: "annotate",
    inputChars: countChars(sentences),
    maxOutputTokens: capped(sentences.length * 1_000 + 600, 8_000),
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

/** One short sentence back (D71); room for minimal reasoning. */
export function describeBudget(material: DescribeInput): LanguageBudget {
  return {
    operation: "describe",
    inputChars: countChars([material.title, material.text]),
    maxOutputTokens: 300,
  };
}

/**
 * The text back, changed (D96): about a token for every 4 characters,
 * with room for a longer version, at most 4,000.
 */
export function reviseBudget(input: RevisionInput): LanguageBudget {
  const chars = countChars([...input.lines, input.instruction]);
  return {
    operation: "revise",
    inputChars: chars,
    maxOutputTokens: capped(chars / 2 + 400, 4_000),
  };
}

/** A news story of about `words` words (D100), like composing one. */
export function newsBudget(input: NewsInput): LanguageBudget {
  return {
    operation: "news",
    inputChars: countChars([input.headline, input.summary, input.level]),
    maxOutputTokens: capped(input.words * 2 + 300, 3_000),
  };
}

/** Checking translations (D115): a short verdict for each pair. */
export function auditBudget(input: AuditInput): LanguageBudget {
  return {
    operation: "audit",
    inputChars: countChars(input.pairs.flatMap((p) => [p.en, p.zh])),
    maxOutputTokens: capped(input.pairs.length * 80 + 200, 4_000),
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

/**
 * Writing feedback (D187): the essay in, about 1,500 tokens out for four
 * scores, eight issues, strengths, and a summary (Chinese runs about one
 * token a character); capped at 3,000.
 */
export function writingBudget(input: {
  essay: string;
  task: string;
}): LanguageBudget {
  return {
    operation: "writing",
    inputChars: input.essay.length + input.task.length,
    maxOutputTokens: 3_000,
  };
}

/**
 * One chat turn (D197): the conversation so far and the new message in;
 * a short reply, one correction, a phrase, and a few glossary words out,
 * plus the model's reasoning.
 */
/**
 * Back-translation answers judged together (D200): about 70 tokens of
 * judgement each (the minimal reasoning is part of the output).
 */
export function backCheckBudget(input: {
  items: { reference: string; meaning: string; answer: string }[];
}): LanguageBudget {
  return {
    operation: "back-check",
    inputChars: input.items.reduce(
      (sum, i) => sum + i.reference.length + i.meaning.length + i.answer.length,
      0,
    ),
    maxOutputTokens: 400 + 200 * input.items.length,
  };
}

export function chatBudget(input: {
  history: { text: string }[];
  message: string;
  custom?: string;
}): LanguageBudget {
  return {
    operation: "chat",
    inputChars:
      input.history.reduce((sum, m) => sum + m.text.length, 0) +
      input.message.length +
      (input.custom?.length ?? 0),
    maxOutputTokens: 1_500,
  };
}
