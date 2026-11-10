import { alignWords } from "./align";
import { normalizeTokens } from "./normalize";

/** A word as the user typed it or as written in the reference. */
export type DisplayWord = { text: string; ok: boolean };

export type WordDiff = {
  /** The user's words; ok=false means wrong or extra (shown struck through). */
  answer: DisplayWord[];
  /** The reference words; ok=false means not typed correctly (shown underlined). */
  reference: DisplayWord[];
};

/**
 * Maps the scoring alignment back onto the words as written, for the
 * two-line dictation feedback. Scoring compares normalized tokens
 * ("don't" → "do not", "six hundred" → "600", D126), but learners should
 * see their own spelling and the original sentence. A written word is ok
 * only if every token made from it matched; a token made from several
 * words ("six hundred") marks all of them. Pure punctuation (e.g. "—")
 * has no tokens and is always ok.
 */
export function wordDiff(reference: string, answer: string): WordDiff {
  const refPieces = reference.split(/\s+/).filter(Boolean);
  const ansPieces = answer.split(/\s+/).filter(Boolean);
  const ref = normalizeTokens(reference);
  const ans = normalizeTokens(answer);
  const refOk = refPieces.map(() => true);
  const ansOk = ansPieces.map(() => true);
  const miss = (ok: boolean[], owners: number[]) =>
    owners.forEach((owner) => (ok[owner] = false));

  let r = 0;
  let a = 0;
  for (const op of alignWords(ref.words, ans.words)) {
    if (op.type === "match") {
      r++;
      a++;
    } else if (op.type === "substitute") {
      miss(refOk, ref.owners[r++]);
      miss(ansOk, ans.owners[a++]);
    } else if (op.type === "delete") {
      miss(refOk, ref.owners[r++]);
    } else {
      miss(ansOk, ans.owners[a++]);
    }
  }

  return {
    answer: ansPieces.map((text, i) => ({ text, ok: ansOk[i] })),
    reference: refPieces.map((text, i) => ({ text, ok: refOk[i] })),
  };
}
