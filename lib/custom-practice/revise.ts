import type { RevisionInput } from "@/lib/ai/types";
import { PRACTICE_LIMITS, type DraftSentence } from "./draft";

/**
 * "Revise with an instruction" (D96): the learner tells the model what to
 * change in a draft ("simpler words", "shorten to 5 sentences"); the
 * model rewrites the English, sentences it didn't touch come back exactly,
 * and only the changed ones are translated again.
 */
export const INSTRUCTION_MAX_CHARS = 200;

/** Revisions the learner can step back through. */
export const UNDO_STEPS = 10;

/** Checks a request from the browser (the Server Action's input). */
export function parseRevisionRequest(input: unknown): RevisionInput | null {
  const raw = (input ?? {}) as Record<string, unknown>;
  const instruction =
    typeof raw.instruction === "string"
      ? raw.instruction.replace(/\s+/g, " ").trim()
      : "";
  const lines = Array.isArray(raw.lines)
    ? raw.lines.filter((line): line is string => typeof line === "string")
    : [];
  if (
    !instruction ||
    [...instruction].length > INSTRUCTION_MAX_CHARS ||
    lines.length === 0 ||
    lines.length !== (raw.lines as unknown[]).length ||
    lines.length > PRACTICE_LIMITS.sentences ||
    lines.some(
      (line) =>
        !line.trim() || [...line].length > PRACTICE_LIMITS.sentenceChars,
    ) ||
    (raw.format !== "dialogue" && raw.format !== "monologue")
  ) {
    return null;
  }
  return { lines, instruction, format: raw.format };
}

/** The model's answer: English lines within the practice limits, or null. */
export function checkRevision(raw: unknown): string[] | null {
  const value = (raw ?? {}) as { lines?: unknown };
  if (!Array.isArray(value.lines)) return null;
  const lines = value.lines
    .filter((line): line is string => typeof line === "string")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => /[A-Za-z]/.test(line));
  if (
    lines.length === 0 ||
    lines.length > PRACTICE_LIMITS.sentences ||
    lines.some((line) => [...line].length > PRACTICE_LIMITS.sentenceChars)
  ) {
    return null;
  }
  return lines;
}

/**
 * The revised draft: each line that matches an old sentence exactly keeps
 * its translation (and speaker); the rest get `zh: null` to translate. A
 * new line in a dialogue takes the speaker of the line before it, flipped.
 */
export function reuseTranslations(
  before: readonly DraftSentence[],
  lines: readonly string[],
): { en: string; zh: string | null; speaker?: 0 | 1 }[] {
  const unused = [...before];
  const dialogue = before.some((s) => s.speaker !== undefined);
  const result: { en: string; zh: string | null; speaker?: 0 | 1 }[] = [];
  for (const en of lines) {
    const at = unused.findIndex((s) => s.en === en);
    if (at >= 0) {
      const [kept] = unused.splice(at, 1);
      result.push({
        en,
        zh: kept.zh,
        ...(kept.speaker === undefined ? {} : { speaker: kept.speaker }),
      });
      continue;
    }
    const previous = result.at(-1)?.speaker;
    result.push({
      en,
      zh: null,
      ...(dialogue
        ? { speaker: previous === undefined ? 0 : previous === 0 ? 1 : 0 }
        : {}),
    });
  }
  return result;
}
