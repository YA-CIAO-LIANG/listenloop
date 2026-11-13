/**
 * What learners type, before it goes to a language model (D159). The
 * text always travels as JSON data in its own user message, never inside
 * the instructions, and the answer must match a strict schema and is
 * checked field by field, so "ignore the instructions above" can't change
 * what the model is asked to do, only the text it works on. This adds
 * the cleanup:
 *
 * - control characters (except line breaks and tabs) and invisible
 *   format characters (zero-width spaces and joiners, bidirectional
 *   overrides, the byte order mark) are removed: they can hide
 *   instructions from a person reading the text, or reorder what's shown;
 * - Unicode is normalized (NFC), so look-alike sequences are one form.
 *
 * Ordinary text is returned unchanged (the AI eval's recordings depend
 * on it), and nothing that a learner can see is dropped.
 */

// C0 and C1 controls but \t \n \r; zero-width and bidi format characters;
// the BOM; and the Unicode "tag" characters (invisible ASCII look-alikes).
// Written as escapes in a string (not a regex literal), so tools keep
// these invisible characters visible in the source.
const HIDDEN = new RegExp(
  String.raw`[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]|\uDB40[\uDC00-\uDC7F]`,
  "g",
);

export function cleanModelText(text: string): string {
  const cleaned = text.replace(HIDDEN, "");
  return cleaned.normalize("NFC");
}

/** Every string inside `input` (objects and arrays too), cleaned. */
export function cleanModelInput<T>(input: T): T {
  if (typeof input === "string") return cleanModelText(input) as T;
  if (Array.isArray(input)) return input.map(cleanModelInput) as T;
  if (input && typeof input === "object") {
    return Object.fromEntries(
      Object.entries(input).map(([key, value]) => [
        key,
        cleanModelInput(value),
      ]),
    ) as T;
  }
  return input;
}
