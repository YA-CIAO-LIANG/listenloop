/**
 * Splits uploaded text into practice sentences (docs/decisions.md D21,
 * D35). A language model splits by meaning (lib/custom-practice/notes.ts,
 * segmentCached); these rules check its answer and stand in when it can't
 * be used. Every non-empty line is its own block (scripts and dialogues
 * put one line per turn); within a line, English breaks after . ! ? …
 * when the next sentence starts with a capital or a digit, and Chinese
 * breaks after 。！？；… Closing quotes and brackets stay with their
 * sentence. English sentences longer than MAX_SENTENCE_WORDS break again
 * at a clause boundary.
 */

export type TextSourceLanguage = "en" | "zh";

/** Lowercased, without the final period. */
const ABBREVIATIONS = new Set([
  "mr",
  "mrs",
  "ms",
  "dr",
  "prof",
  "sr",
  "jr",
  "st",
  "mt",
  "vs",
  "etc",
  "no",
  "fig",
  "approx",
  "dept",
  "inc",
  "ltd",
  "co",
  "jan",
  "feb",
  "mar",
  "apr",
  "jun",
  "jul",
  "aug",
  "sep",
  "sept",
  "oct",
  "nov",
  "dec",
]);

const ENGLISH_BREAK = /([.!?…]+)(["'”’)\]]*)(\s+)(?=["'“‘(\[]?[A-Z0-9])/g;
const CHINESE_BREAK = /([。！？!?；;…]+)([」』”’）)]*)/g;

/** Whether the period at `end` closes an abbreviation, not a sentence. */
function isAbbreviation(line: string, end: number): boolean {
  const word = /(\S+)$/.exec(line.slice(0, end))?.[1] ?? "";
  const bare = word.replace(/^["'“‘(\[]+/, "").toLowerCase();
  if (ABBREVIATIONS.has(bare)) return true;
  // Initials and dotted forms: "J.", "U.S.", "a.m.", "e.g.", "i.e."
  return /^([a-z]\.)*[a-z]$/.test(bare);
}

/** Good dictation length, in English words (e+ 4). */
export const SENTENCE_WORDS = { min: 5, max: 25 } as const;

const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

/** Where a long English sentence can break: after ; or : or before a conjunction after a comma. */
const CLAUSE_BREAK =
  /[;:]\s+|,\s+(?=(?:and|but|so|or|because|while|although|though|which|who|when|where|if|unless|since)\b)/g;

/**
 * Breaks an English sentence longer than SENTENCE_WORDS.max at the clause
 * boundary nearest its middle, again and again, as long as both parts
 * keep at least SENTENCE_WORDS.min words. Without such a boundary it
 * stays whole (a long sentence beats a broken phrase).
 */
export function splitLong(sentence: string): string[] {
  if (words(sentence) <= SENTENCE_WORDS.max) return [sentence];
  const middle = sentence.length / 2;
  let best: number | null = null;
  for (const match of sentence.matchAll(CLAUSE_BREAK)) {
    const end = match.index + match[0].length;
    const head = sentence.slice(0, end).trim();
    const tail = sentence.slice(end).trim();
    if (words(head) < SENTENCE_WORDS.min || words(tail) < SENTENCE_WORDS.min) {
      continue;
    }
    if (best === null || Math.abs(end - middle) < Math.abs(best - middle)) {
      best = end;
    }
  }
  if (best === null) return [sentence];
  return [
    ...splitLong(sentence.slice(0, best).trim()),
    ...splitLong(sentence.slice(best).trim()),
  ];
}

function splitEnglishLine(line: string): string[] {
  const sentences: string[] = [];
  let start = 0;
  for (const match of line.matchAll(ENGLISH_BREAK)) {
    const [, punctuation, closers] = match;
    const end = match.index + punctuation.length + closers.length;
    if (punctuation === "." && isAbbreviation(line, match.index)) continue;
    sentences.push(line.slice(start, end));
    start = end;
  }
  sentences.push(line.slice(start));
  return sentences.flatMap((sentence) => splitLong(sentence.trim()));
}

function splitChineseLine(line: string): string[] {
  const sentences: string[] = [];
  let start = 0;
  for (const match of line.matchAll(CHINESE_BREAK)) {
    const end = match.index + match[0].length;
    sentences.push(line.slice(start, end));
    start = end;
  }
  sentences.push(line.slice(start));
  return sentences;
}

/** The text's non-empty lines, whitespace tidied: the blocks to split. */
export function textLines(text: string): string[] {
  return text
    .split(/\r\n|[\r\n\u2028\u2029]/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => /[\p{L}\p{N}]/u.test(line));
}

const hasContent = (sentence: string) => /[\p{L}\p{N}]/u.test(sentence);

/** One line's sentences by the rules above. */
export function splitLine(line: string, language: TextSourceLanguage) {
  const split = language === "zh" ? splitChineseLine : splitEnglishLine;
  return split(line)
    .map((sentence) => sentence.trim())
    .filter(hasContent);
}

export function splitSentences(
  text: string,
  language: TextSourceLanguage,
): string[] {
  return textLines(text).flatMap((line) => splitLine(line, language));
}

const squeeze = (text: string) => text.replace(/\s+/g, "");

const isPieces = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((piece) => typeof piece === "string");

/**
 * Each line's pieces as the model cut them, or null for a line it didn't
 * cut cleanly: the model may only cut, never change, add, drop, or
 * reorder text, so a line's pieces joined must be the line itself
 * (ignoring spaces). With one list per line, each line is checked on its
 * own. With a different number of lists (D153: it once gave one list per
 * sentence), the pieces are matched to the lines in order, and used only
 * if every line is made of whole pieces.
 */
export function modelSegments(
  lines: readonly string[],
  segmented: unknown,
): (string[] | null)[] {
  const perLine = Array.isArray(segmented) ? segmented : [];
  if (perLine.length === lines.length) {
    return lines.map((line, i) => {
      const pieces: unknown = perLine[i];
      return isPieces(pieces) && squeeze(pieces.join("")) === squeeze(line)
        ? pieces
        : null;
    });
  }
  const none = lines.map(() => null);
  if (!perLine.every(isPieces)) return none;
  const pieces = (perLine as string[][]).flat();
  let next = 0;
  const result: string[][] = [];
  for (const line of lines) {
    const target = squeeze(line);
    const own: string[] = [];
    let joined = "";
    while (next < pieces.length && joined.length < target.length) {
      own.push(pieces[next]);
      joined += squeeze(pieces[next]);
      next += 1;
    }
    if (joined !== target) return none;
    result.push(own);
  }
  return next === pieces.length ? result : none;
}

/**
 * Each line's sentences from a language model's split (one list of
 * pieces per line, see modelSegments). A line the model didn't cut
 * cleanly is split by the rules instead. English pieces still longer
 * than SENTENCE_WORDS.max break at a clause (D153: the model left a
 * 40-word sentence whole). Pieces without letters or digits go.
 */
export function segmentsPerLine(
  lines: readonly string[],
  segmented: unknown,
  language: TextSourceLanguage,
): string[][] {
  const model = modelSegments(lines, segmented);
  return lines.map((line, index) => {
    const pieces = model[index];
    if (!pieces) return splitLine(line, language);
    const tidy = pieces
      .map((piece) => piece.replace(/\s+/g, " ").trim())
      .filter(hasContent);
    return language === "en" ? tidy.flatMap(splitLong) : tidy;
  });
}

/** The sentences of `lines` from a language model's split, in order. */
export function checkedSegments(
  lines: readonly string[],
  segmented: unknown,
  language: TextSourceLanguage,
): string[] {
  return segmentsPerLine(lines, segmented, language).flat();
}

/**
 * The likely language of `text`: Chinese when Han characters are at least
 * a third of its letters, so an English text quoting a few Chinese words
 * stays English. The learner can change it before splitting.
 */
export function detectTextLanguage(text: string): TextSourceLanguage {
  const han = text.match(/\p{Script=Han}/gu)?.length ?? 0;
  const letters = text.match(/\p{L}/gu)?.length ?? 0;
  return letters > 0 && han / letters >= 1 / 3 ? "zh" : "en";
}
