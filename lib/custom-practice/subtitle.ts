import type { DescribeInput } from "@/lib/ai/types";
import { SUBTITLE_MAX } from "@/lib/videos";

/**
 * A material's one-line subtitle for the library card (D71): written by
 * the language model from the title and the text's beginning, checked
 * here, and editable by admins.
 */

/** How much of the text the model reads: enough to tell the topic. */
export const DESCRIBE_TEXT_CHARS = 600;

export function describeInput(
  title: string,
  sentences: readonly string[],
): DescribeInput {
  let text = "";
  for (const sentence of sentences) {
    if (text.length + sentence.length + 1 > DESCRIBE_TEXT_CHARS) break;
    text += (text ? " " : "") + sentence;
  }
  return {
    title,
    text: text || sentences[0]?.slice(0, DESCRIBE_TEXT_CHARS) || "",
  };
}

/**
 * A subtitle as stored: spaces squeezed, wrapping quotes dropped, at most
 * SUBTITLE_MAX characters. Null when nothing usable is left.
 */
export function cleanSubtitle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const tidy = value
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["'「『“]+|["'」』”]+$/g, "")
    .trim();
  return tidy && [...tidy].length <= SUBTITLE_MAX ? tidy : null;
}

/** The model's answer (`{ subtitle }`), checked. */
export function subtitleFromModel(raw: unknown): string | null {
  return typeof raw === "object" && raw !== null
    ? cleanSubtitle((raw as { subtitle?: unknown }).subtitle)
    : null;
}
