import { textLines } from "./split";

/**
 * Two speakers in a dialogue (D57): in the text box a line starts with
 * "A:" or "B:" (a full-width colon works too). The label isn't read
 * aloud: it picks the voice, A the practice's voice and B the second
 * one. Lines without a label are A's.
 */
export type Speaker = 0 | 1;

const LABEL = /^\s*([AaBb])\s*[:：]\s*/;

/** Labels a model's dialogue lines, which alternate speakers. */
export function withSpeakers(text: string): string {
  return text
    .split("\n")
    .filter((line) => line.trim())
    .map((line, i) => `${i % 2 === 0 ? "A" : "B"}: ${line.replace(LABEL, "")}`)
    .join("\n");
}

/** A line's speaker (null without a label) and its text without it. */
export function parseSpeakerLine(line: string): {
  speaker: Speaker | null;
  text: string;
} {
  const match = LABEL.exec(line);
  if (!match) return { speaker: null, text: line };
  return {
    speaker: match[1].toUpperCase() === "B" ? 1 : 0,
    text: line.slice(match[0].length),
  };
}

/** The text's lines (as textLines tidies them), labels taken off. */
export function speakerLines(
  text: string,
): { speaker: Speaker | null; text: string }[] {
  return textLines(text)
    .map(parseSpeakerLine)
    .filter((line) => /[\p{L}\p{N}]/u.test(line.text));
}

/** Whether any line is labeled: the text is a two-voice dialogue. */
export const isDialogue = (
  lines: readonly { speaker: Speaker | null }[],
): boolean => lines.some((line) => line.speaker === 1);
