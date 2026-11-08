/**
 * Joins the results of one speech-recognition attempt into what was said.
 *
 * Desktop Chrome sends each phrase once: finished phrases, then the phrase
 * still being heard. Android Chrome (continuous mode especially) repeats
 * itself: a new result often holds all of the earlier ones again ("I",
 * "I am", "I am going"), or the same phrase arrives twice. Joining them as
 * they come gives "I I am I am going", which scores extra and missing words
 * wrongly (D89). So each result either replaces what came before (when it
 * starts with it), is dropped (when it's already at the end), or is added.
 */
export type RecognitionPiece = { transcript: string; isFinal?: boolean };

const normalize = (text: string) =>
  text.toLowerCase().replace(/\s+/g, " ").trim();

/** Words of `text`, compared without case or punctuation. */
const words = (text: string) =>
  normalize(text)
    .split(" ")
    .map((word) => word.replace(/[^\p{L}\p{N}']/gu, ""))
    .filter(Boolean);

const startsWith = (whole: string[], part: string[]) =>
  part.length <= whole.length && part.every((word, i) => whole[i] === word);

const endsWith = (whole: string[], part: string[]) =>
  part.length <= whole.length &&
  part.every((word, i) => whole[whole.length - part.length + i] === word);

export function mergeTranscript(pieces: readonly RecognitionPiece[]): string {
  let text = "";
  for (const piece of pieces) {
    const next = piece.transcript.replace(/\s+/g, " ").trim();
    const nextWords = words(next);
    if (nextWords.length === 0) continue;
    const soFar = words(text);
    if (soFar.length === 0 || startsWith(nextWords, soFar)) {
      // First result, or a longer version of everything so far.
      text = next;
    } else if (nextWords.length >= 2 && endsWith(soFar, nextWords)) {
      // Already have it (a repeated result). Single words may really be
      // said twice ("No, no"), so only phrases count as repeats.
      continue;
    } else {
      text = `${text} ${next}`;
    }
  }
  return text;
}

/** Android Chrome repeats results in continuous mode, so it listens once. */
export function isAndroid(userAgent: string): boolean {
  return /\bAndroid\b/i.test(userAgent);
}
