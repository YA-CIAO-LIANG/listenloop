export type AlignOp =
  | { type: "match"; ref: string; hyp: string }
  | { type: "substitute"; ref: string; hyp: string }
  /** A reference word the user missed. */
  | { type: "delete"; ref: string }
  /** An extra word the user added. */
  | { type: "insert"; hyp: string };

type Cell = { matches: number; edits: number };

/** More matches wins; with equal matches, fewer edits wins. */
function isBetter(a: Cell, b: Cell): boolean {
  return (
    a.matches > b.matches || (a.matches === b.matches && a.edits < b.edits)
  );
}

/**
 * Word-level alignment between the reference words and the user's words,
 * returned in reference order. It maximizes matched words first, so every
 * word the user got right (in order) earns credit, then minimizes edits so a
 * wrong word pairs up as a substitution rather than a missing + extra pair.
 */
export function alignWords(ref: string[], hyp: string[]): AlignOp[] {
  const rows = ref.length + 1;
  const cols = hyp.length + 1;
  // best[i][j] = best alignment of ref[0..i) with hyp[0..j)
  const best: Cell[][] = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => ({ matches: 0, edits: i + j })),
  );

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const same = ref[i - 1] === hyp[j - 1];
      const candidates: Cell[] = [
        {
          matches: best[i - 1][j - 1].matches + (same ? 1 : 0),
          edits: best[i - 1][j - 1].edits + (same ? 0 : 1),
        },
        { matches: best[i - 1][j].matches, edits: best[i - 1][j].edits + 1 },
        { matches: best[i][j - 1].matches, edits: best[i][j - 1].edits + 1 },
      ];
      best[i][j] = candidates.reduce((a, b) => (isBetter(b, a) ? b : a));
    }
  }

  const ops: AlignOp[] = [];
  let i = ref.length;
  let j = hyp.length;
  const equals = (a: Cell, b: Cell) =>
    a.matches === b.matches && a.edits === b.edits;

  while (i > 0 || j > 0) {
    const here = best[i][j];
    if (i > 0 && j > 0) {
      const same = ref[i - 1] === hyp[j - 1];
      const prev = best[i - 1][j - 1];
      const viaDiagonal = {
        matches: prev.matches + (same ? 1 : 0),
        edits: prev.edits + (same ? 0 : 1),
      };
      if (equals(here, viaDiagonal)) {
        ops.push(
          same
            ? { type: "match", ref: ref[i - 1], hyp: hyp[j - 1] }
            : { type: "substitute", ref: ref[i - 1], hyp: hyp[j - 1] },
        );
        i--;
        j--;
        continue;
      }
    }
    const up = i > 0 ? best[i - 1][j] : null;
    if (up && equals(here, { matches: up.matches, edits: up.edits + 1 })) {
      ops.push({ type: "delete", ref: ref[i - 1] });
      i--;
    } else {
      ops.push({ type: "insert", hyp: hyp[j - 1] });
      j--;
    }
  }
  return ops.reverse();
}

/** Number of reference words the user got exactly right. */
export function countMatches(ops: AlignOp[]): number {
  return ops.filter((op) => op.type === "match").length;
}
