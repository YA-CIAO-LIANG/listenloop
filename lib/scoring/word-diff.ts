import { alignWords } from "./align";
import { normalizeWords } from "./normalize";

/** A word as the user typed it or as written in the reference. */
export type DisplayWord = { text: string; ok: boolean };

export type WordDiff = {
  /** The user's words; ok=false means wrong or extra (shown struck through). */
  answer: DisplayWord[];
  /** The reference words; ok=false means not typed correctly (shown underlined). */
  reference: DisplayWord[];
};

type Piece = { text: string; tokens: string[] };

/** Splits on whitespace, keeping punctuation, with each piece's normalized tokens. */
function pieces(text: string): Piece[] {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((piece) => ({ text: piece, tokens: normalizeWords(piece) }));
}

/**
 * Maps the scoring alignment back onto the words as written, for the
 * two-line dictation feedback. Scoring compares normalized tokens
 * ("don't" → "do not"), but learners should see their own spelling and the
 * original sentence. A written word is ok only if all of its tokens matched.
 * Pure punctuation (e.g. "—") has no tokens and is always ok.
 */
export function wordDiff(reference: string, answer: string): WordDiff {
  const refPieces = pieces(reference);
  const ansPieces = pieces(answer);

  // Owner piece of every normalized token, in order.
  const refOwner = refPieces.flatMap((p, i) => p.tokens.map(() => i));
  const ansOwner = ansPieces.flatMap((p, i) => p.tokens.map(() => i));
  const refOk = refPieces.map(() => true);
  const ansOk = ansPieces.map(() => true);

  let r = 0;
  let a = 0;
  for (const op of alignWords(
    refPieces.flatMap((p) => p.tokens),
    ansPieces.flatMap((p) => p.tokens),
  )) {
    if (op.type === "match") {
      r++;
      a++;
    } else if (op.type === "substitute") {
      refOk[refOwner[r++]] = false;
      ansOk[ansOwner[a++]] = false;
    } else if (op.type === "delete") {
      refOk[refOwner[r++]] = false;
    } else {
      ansOk[ansOwner[a++]] = false;
    }
  }

  return {
    answer: ansPieces.map((p, i) => ({ text: p.text, ok: ansOk[i] })),
    reference: refPieces.map((p, i) => ({ text: p.text, ok: refOk[i] })),
  };
}
