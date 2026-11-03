/**
 * Splits uploaded text into practice sentences (docs/decisions.md D21).
 * Every non-empty line is its own block (scripts and dialogues put one
 * line per turn); within a line, English breaks after . ! ? … when the
 * next sentence starts with a capital or a digit, and Chinese breaks after
 * 。！？；… Closing quotes and brackets stay with their sentence.
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
  return sentences;
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

export function splitSentences(
  text: string,
  language: TextSourceLanguage,
): string[] {
  const splitLine = language === "zh" ? splitChineseLine : splitEnglishLine;
  return text
    .split(/\r\n|[\r\n\u2028\u2029]/)
    .flatMap((line) => splitLine(line.replace(/\s+/g, " ")))
    .map((sentence) => sentence.trim())
    .filter((sentence) => /[\p{L}\p{N}]/u.test(sentence));
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
