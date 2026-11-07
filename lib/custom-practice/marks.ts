import { wordDiff } from "@/lib/scoring/word-diff";

/**
 * Where to put the highlighter (D66, D68). A sentence is split into its
 * whitespace-separated pieces, as the dictation feedback shows it; the
 * pieces the learner got wrong (dictation) or didn't say (shadowing) are
 * "missed". Notes quote parts of the sentence (a word, a chunk, a linked
 * phrase); those quotes are found in the sentence to tell which of their
 * words were missed, and which notes concern a mistake.
 */
export type Piece = { text: string; start: number; end: number };

/** The sentence's pieces with their character positions. */
export function sentencePieces(en: string): Piece[] {
  const pieces: Piece[] = [];
  for (const match of en.matchAll(/\S+/g)) {
    pieces.push({
      text: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return pieces;
}

/** Indexes of the pieces the learner missed, comparing what they wrote or said. */
export function missedPieces(en: string, attempt: string): Set<number> {
  const missed = new Set<number>();
  wordDiff(en, attempt).reference.forEach((word, i) => {
    if (!word.ok) missed.add(i);
  });
  return missed;
}

/** Same letters, straight quotes, lowercase: for finding quotes. */
const fold = (text: string) =>
  text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').toLowerCase();

/** Where `span` is in the sentence, as [start, end), or null. */
export function spanRange(en: string, span: string): [number, number] | null {
  const tidy = span.replace(/\s+/g, " ").trim();
  if (!tidy) return null;
  const at = fold(en.replace(/\s+/g, " ")).indexOf(fold(tidy));
  return at === -1 ? null : [at, at + tidy.length];
}

/** The pieces a span covers, by index. */
export function piecesIn(en: string, span: string): number[] {
  const range = spanRange(en, span);
  if (!range) return [];
  return sentencePieces(en.replace(/\s+/g, " "))
    .map((piece, i) => ({ piece, i }))
    .filter(({ piece }) => piece.start < range[1] && piece.end > range[0])
    .map(({ i }) => i);
}

/** Whether any word of `span` was missed. */
export function touchesMissed(
  en: string,
  span: string,
  missed: ReadonlySet<number>,
): boolean {
  return piecesIn(en, span).some((i) => missed.has(i));
}

export type MarkKindOrNone = "miss" | "key" | null;
export type Segment = { text: string; mark: MarkKindOrNone };

/** Runs of pieces with the same mark, spaces included, as segments. */
function segments(
  pieces: readonly Piece[],
  source: string,
  markOf: (index: number) => MarkKindOrNone,
): Segment[] {
  const out: Segment[] = [];
  pieces.forEach((piece, i) => {
    const mark = markOf(i);
    const last = out.at(-1);
    const gap = i > 0 ? source.slice(pieces[i - 1].end, piece.start) : "";
    if (last && last.mark === mark) {
      last.text += gap + piece.text;
    } else {
      if (gap) {
        if (last && last.mark === null) last.text += gap;
        else out.push({ text: gap, mark: null });
      }
      // Plain text right after a plain gap joins it.
      const before = out.at(-1);
      if (before && before.mark === null && mark === null)
        before.text += piece.text;
      else out.push({ text: piece.text, mark });
    }
  });
  return out;
}

/**
 * The sentence as segments: missed words marked "miss", then the key
 * words (`keys`, quotes of the sentence) marked "key". A missed word
 * stays "miss" even inside a key phrase: the mistake matters more.
 */
export function markSentence(
  en: string,
  missed: ReadonlySet<number>,
  keys: readonly string[] = [],
): Segment[] {
  const keyed = new Set(keys.flatMap((key) => piecesIn(en, key)));
  return segments(sentencePieces(en), en, (i) =>
    missed.has(i) ? "miss" : keyed.has(i) ? "key" : null,
  );
}

/**
 * A quote of the sentence (a chunk, a linked phrase) as segments, its
 * missed words marked. A quote that isn't found is one plain segment.
 */
export function markQuote(
  en: string,
  quote: string,
  missed: ReadonlySet<number>,
): Segment[] {
  const covered = piecesIn(en, quote);
  if (covered.length === 0 || !covered.some((i) => missed.has(i))) {
    return [{ text: quote, mark: null }];
  }
  const own = sentencePieces(quote);
  // The quote's pieces line up with the sentence's from its first one on.
  return segments(own, quote, (k) =>
    missed.has(covered[0] + k) ? "miss" : null,
  );
}

/** The missed words themselves, in order, for a plain list. */
export function missedWords(en: string, missed: ReadonlySet<number>): string[] {
  return sentencePieces(en)
    .filter((_, i) => missed.has(i))
    .map((piece) =>
      piece.text.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, ""),
    )
    .filter(Boolean);
}
