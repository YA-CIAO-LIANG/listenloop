import { shortenInstruction } from "@/lib/ai/prompts";
import type { RevisionInput } from "@/lib/ai/types";
import {
  needsShortening,
  shortenedText,
  type CompositionPrompt,
  type GeneratedText,
} from "./generation";
import { checkRevision } from "./revise";

/**
 * A written text that came out too long is sent back once to be
 * shortened (D153), through "revise with an instruction": the model wrote
 * about twice the words asked for. Production and the eval
 * (lib/evals/pipeline.ts) both go through here, so the eval grades it.
 */

/** The revision that asks for `text` at the words asked for. */
export function shortenRequest(
  text: GeneratedText,
  prompt: CompositionPrompt,
): RevisionInput {
  return {
    lines: text.text.split("\n"),
    instruction: shortenInstruction(prompt.words),
    format: prompt.format,
  };
}

/**
 * `first`, shortened when it's too long. `revise` makes the call and
 * returns the model's raw answer; when it fails, or the answer isn't
 * shorter and usable, the first text stays.
 */
export async function shortenIfLong(
  first: GeneratedText,
  prompt: CompositionPrompt,
  revise: (input: RevisionInput) => Promise<unknown>,
): Promise<GeneratedText> {
  if (!needsShortening(first.text, prompt.words)) return first;
  const request = shortenRequest(first, prompt);
  try {
    const revision = checkRevision(await revise(request), request.lines);
    return shortenedText(
      first,
      revision?.status === "changed" ? revision.lines : null,
      prompt.words,
    );
  } catch {
    return first;
  }
}
