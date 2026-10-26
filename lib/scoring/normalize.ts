/**
 * Turns a sentence into comparable words: lowercase, no punctuation, common
 * contractions expanded, and small numbers spelled out. Applied to both the
 * reference sentence and the user's answer, so "Don't!" matches "do not" and
 * "5" (speech recognition) matches "five".
 */
export function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[‘’`]/g, "'")
    .replace(/[^\p{L}\p{N}'\s]/gu, " ") // hyphens become spaces: well-known → well known
    .split(/\s+/)
    .map((token) => token.replace(/^'+|'+$/g, ""))
    .flatMap(expandToken)
    .filter(Boolean);
}

function expandToken(token: string): string[] {
  const expanded = CONTRACTIONS[token];
  if (expanded) return expanded.split(" ");
  if (/^\d{1,2}$/.test(token)) return numberToWords(Number(token)).split(" ");
  return [token];
}

// Only unambiguous forms. 's after nouns (possessive) and 'd (had/would) are
// left as-is because the right expansion depends on context.
const CONTRACTIONS: Record<string, string> = {
  "i'm": "i am",
  "you're": "you are",
  "we're": "we are",
  "they're": "they are",
  "i've": "i have",
  "you've": "you have",
  "we've": "we have",
  "they've": "they have",
  "i'll": "i will",
  "you'll": "you will",
  "he'll": "he will",
  "she'll": "she will",
  "it'll": "it will",
  "we'll": "we will",
  "they'll": "they will",
  "it's": "it is",
  "he's": "he is",
  "she's": "she is",
  "that's": "that is",
  "there's": "there is",
  "here's": "here is",
  "what's": "what is",
  "who's": "who is",
  "where's": "where is",
  "how's": "how is",
  "let's": "let us",
  "don't": "do not",
  "doesn't": "does not",
  "didn't": "did not",
  "isn't": "is not",
  "aren't": "are not",
  "wasn't": "was not",
  "weren't": "were not",
  "haven't": "have not",
  "hasn't": "has not",
  "hadn't": "had not",
  "won't": "will not",
  "wouldn't": "would not",
  "shouldn't": "should not",
  "couldn't": "could not",
  "mustn't": "must not",
  "can't": "can not",
  cannot: "can not",
};

const ONES = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];

const TENS = [
  "",
  "",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
];

/** 0–99 → words, e.g. 42 → "forty two" (hyphens are dropped by normalizeWords). */
function numberToWords(n: number): string {
  if (n < 20) return ONES[n];
  const tens = TENS[Math.floor(n / 10)];
  return n % 10 === 0 ? tens : `${tens} ${ONES[n % 10]}`;
}
