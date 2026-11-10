/**
 * Turns a sentence into comparable words (D126): lowercase, no
 * punctuation, common contractions expanded, and every way of writing a
 * number made the same token. Applied to both the reference sentence and
 * the learner's answer (typed or heard), so "Don't!" matches "do not" and
 * these all match each other:
 *
 * - 600 = six hundred; 6 million = 6,000,000 = six million; 1.5 = one point five
 * - 1st = first, 21st = twenty-first; 90% = ninety percent
 * - $5 = five dollars = 5 dollars; $3.50 = three dollars fifty
 * - 9:30 = nine thirty; 7 a.m. = seven am = 7 am
 * - 2025 = twenty twenty-five = two thousand twenty-five
 *
 * Number tokens are digits ("600", "1.5"), ordinals end in "th" ("21th"),
 * so one number is one word however it's written.
 */
export function normalizeWords(text: string): string[] {
  return normalizeTokens(text).words;
}

/**
 * normalizeWords with where each word came from: `owners[k]` are the
 * indexes of the whitespace-separated pieces of `text` that word k was
 * made from ("six hundred" → one word from two pieces), so the feedback
 * can mark the words as written (lib/scoring/word-diff.ts).
 */
export function normalizeTokens(text: string): {
  words: string[];
  owners: number[][];
} {
  const raw = text
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((piece, owner) =>
      rawTokens(piece).map((word) => ({ word, owners: [owner] })),
    );
  const merged = mergeYears(readNumbers(raw));
  return {
    words: merged.map((t) => t.word),
    owners: merged.map((t) => t.owners),
  };
}

type Token = { word: string; owners: number[] };

/** One piece of text → raw words, before numbers are read across pieces. */
function rawTokens(piece: string): string[] {
  const text = piece
    .toLowerCase()
    .replace(/[‘’`]/g, "'")
    // 7a.m. / 7am / 7 a.m. → 7 am
    .replace(/\b([ap])\.m\.?(?=\W|$)/g, "$1m")
    .replace(/(\d)([ap]m)\b/g, "$1 $2")
    // 1,000,000 → 1000000 (only thousands groups, so "1, 2" stays apart)
    .replace(/(\d),(?=\d{3}(?!\d))/g, "$1")
    // 9:30 → 9 30; 9:05 → 9 oh 5 (as it's read)
    .replace(/(\d):0(\d)/g, "$1 oh $2")
    .replace(/(\d):(\d)/g, "$1 $2")
    // $5 → "$ 5", read as "5 dollars" once the number is known
    .replace(/\$(?=\d)/g, " $ ")
    .replace(/%/g, " percent ") // 90% → 90 percent
    // A decimal point stays; any other punctuation becomes a space
    // (hyphens too: well-known → well known, twenty-one → twenty one).
    .replace(/(\d)\.(?=\d)/g, "$1\u0000")
    .replace(/[^\p{L}\p{N}'\u0000$\s]/gu, " ")
    .replace(/\u0000/g, ".");
  return text
    .split(/\s+/)
    .map((token) => token.replace(/^'+|'+$/g, ""))
    .flatMap((token) => {
      const expanded = CONTRACTIONS[token];
      return expanded ? expanded.split(" ") : [token];
    })
    .filter(Boolean);
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

const ONES: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};

const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const SCALES: Record<string, number> = {
  hundred: 100,
  thousand: 1e3,
  million: 1e6,
  billion: 1e9,
  trillion: 1e12,
};

const ORDINAL_ONES: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  thirteenth: 13,
  fourteenth: 14,
  fifteenth: 15,
  sixteenth: 16,
  seventeenth: 17,
  eighteenth: 18,
  nineteenth: 19,
};

const ORDINAL_TENS: Record<string, number> = {
  twentieth: 20,
  thirtieth: 30,
  fortieth: 40,
  fiftieth: 50,
  sixtieth: 60,
  seventieth: 70,
  eightieth: 80,
  ninetieth: 90,
};

const ORDINAL_SCALES: Record<string, number> = {
  hundredth: 100,
  thousandth: 1e3,
  millionth: 1e6,
  billionth: 1e9,
};

const DIGITS = /^\d+(\.\d+)?$/;
const DIGIT_ORDINAL = /^(\d+)(st|nd|rd|th)$/;

/** A number as one token: "600", "1.5"; an ordinal as "21th". */
const numberWord = (value: number, ordinal: boolean) =>
  ordinal ? `${value}th` : String(Number(value.toPrecision(15)));

const isNumberStart = (tokens: Token[], i: number) => {
  const word = tokens[i]?.word;
  if (word === undefined) return false;
  return (
    DIGITS.test(word) ||
    word in ONES ||
    word in TENS ||
    word in ORDINAL_ONES ||
    word in ORDINAL_TENS ||
    word in ORDINAL_SCALES ||
    // "a hundred", "a million"
    (word === "a" &&
      (tokens[i + 1]?.word in SCALES || tokens[i + 1]?.word in ORDINAL_SCALES))
  );
};

/**
 * Reads one number starting at `start`: digits or words, with scales
 * ("6 million", "two thousand and five"), a decimal ("one point five"),
 * or an ordinal at the end ("twenty-first"). Words that can't continue a
 * number end it, so "nine thirty" is two numbers, as a time is read.
 */
function readNumber(
  tokens: Token[],
  start: number,
): { value: number; ordinal: boolean; end: number } | null {
  let total = 0;
  let current = 0;
  // The small part since the last scale: lets "twenty five" join but not
  // "five twenty" or "twenty twenty".
  let small: number | null = null;
  let lastScale = Infinity;
  let i = start;
  let any = false;

  const word = () => tokens[i]?.word;
  const addSmall = (value: number) => {
    current += value;
    small = value;
    any = true;
    i++;
  };

  if (word() === "a") {
    current = 1;
    small = 1;
    any = true;
    i++;
  } else if (DIGITS.test(word() ?? "")) {
    current = Number(word());
    small = current < 100 ? current : null;
    any = true;
    i++;
    // Digits take only a scale after them ("6 million").
    const scale = SCALES[word() ?? ""];
    if (scale && scale > 100) {
      total += current * scale;
      current = 0;
      i++;
    } else if (scale === 100 && Number.isInteger(current) && current < 100) {
      current *= 100;
      i++;
    }
    return { value: total + current, ordinal: false, end: i };
  }

  while (i < tokens.length) {
    const w = word()!;
    if (w in ONES) {
      const value = ONES[w];
      // Ones join a tens word ("twenty five"), or start after a scale.
      if (
        small === null ||
        (small >= 20 && small % 10 === 0 && value < 10 && value > 0)
      ) {
        addSmall(value);
        continue;
      }
      break;
    }
    if (w in TENS) {
      if (small !== null) break;
      addSmall(TENS[w]);
      continue;
    }
    if (w in ORDINAL_ONES) {
      const value = ORDINAL_ONES[w];
      if (small === null || (small >= 20 && small % 10 === 0 && value < 10)) {
        return { value: total + current + value, ordinal: true, end: i + 1 };
      }
      break;
    }
    if (w in ORDINAL_TENS) {
      if (small !== null) break;
      return {
        value: total + current + ORDINAL_TENS[w],
        ordinal: true,
        end: i + 1,
      };
    }
    if (w in ORDINAL_SCALES) {
      const scale = ORDINAL_SCALES[w];
      if (scale >= lastScale) break;
      return {
        value: total + (current || 1) * scale,
        ordinal: true,
        end: i + 1,
      };
    }
    if (w in SCALES && any) {
      const scale = SCALES[w];
      if (scale === 100) {
        // "five hundred", also inside a larger number ("two thousand
        // five hundred"); never "hundred hundred".
        if (current === 0 || current >= 100) break;
        current *= 100;
        small = null;
        i++;
        continue;
      }
      if (scale >= lastScale || current === 0) break;
      total += current * scale;
      current = 0;
      small = null;
      lastScale = scale;
      i++;
      continue;
    }
    // "one hundred and five", "two thousand and twenty"
    if (
      w === "and" &&
      any &&
      small === null &&
      (tokens[i + 1]?.word in ONES || tokens[i + 1]?.word in TENS)
    ) {
      i++;
      continue;
    }
    // "one point five": digits after the point, one word each.
    if (w === "point" && any && tokens[i + 1]?.word in ONES) {
      let decimals = "";
      let j = i + 1;
      while (
        tokens[j] &&
        ONES[tokens[j].word] !== undefined &&
        ONES[tokens[j].word] < 10
      ) {
        decimals += String(ONES[tokens[j].word]);
        j++;
      }
      if (!decimals) break;
      const value = total + current + Number(`0.${decimals}`);
      i = j;
      const scale = SCALES[word() ?? ""];
      if (scale && scale > 100) {
        return { value: value * scale, ordinal: false, end: i + 1 };
      }
      return { value, ordinal: false, end: i };
    }
    break;
  }
  return any ? { value: total + current, ordinal: false, end: i } : null;
}

/** Reads numbers (and "$" before them) into single tokens. */
function readNumbers(tokens: Token[]): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    const ordinal = DIGIT_ORDINAL.exec(token.word);
    if (ordinal) {
      out.push({ word: `${Number(ordinal[1])}th`, owners: token.owners });
      i++;
      continue;
    }
    const dollar = token.word === "$";
    const at = dollar ? i + 1 : i;
    if (!isNumberStart(tokens, at)) {
      if (!dollar) out.push(token);
      i++;
      continue;
    }
    const read = readNumber(tokens, at);
    if (!read || read.end === at) {
      out.push(token);
      i++;
      continue;
    }
    const owners = [
      ...new Set(tokens.slice(i, read.end).flatMap((t) => t.owners)),
    ];
    if (dollar) {
      // $3.50 is read "three dollars fifty"; $1 "one dollar".
      const whole = Math.floor(read.value);
      const cents = Math.round((read.value - whole) * 100);
      out.push({ word: String(whole), owners });
      out.push({ word: whole === 1 && !cents ? "dollar" : "dollars", owners });
      if (cents) out.push({ word: String(cents), owners });
    } else {
      out.push({ word: numberWord(read.value, read.ordinal), owners });
    }
    i = read.end;
  }
  return out;
}

const isPlainNumber = (word: string | undefined) =>
  word !== undefined && /^\d+$/.test(word);

/**
 * Years and clock times read in pairs: "twenty twenty-five" (20 25) is
 * 2025, "nineteen oh five" (19 oh 5) is 1905. Applied to both sides, so
 * 10:30 and "ten thirty" both become 1030 and still match.
 */
function mergeYears(tokens: Token[]): Token[] {
  const out: Token[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const a = tokens[i];
    const b = tokens[i + 1];
    const c = tokens[i + 2];
    const high = Number(a.word);
    if (isPlainNumber(a.word) && high >= 10 && high <= 99) {
      if (
        isPlainNumber(b?.word) &&
        Number(b.word) >= 10 &&
        Number(b.word) <= 99
      ) {
        out.push({
          word: String(high * 100 + Number(b.word)),
          owners: [...new Set([...a.owners, ...b.owners])],
        });
        i++;
        continue;
      }
      if (b?.word === "oh" && isPlainNumber(c?.word) && Number(c.word) < 10) {
        out.push({
          word: String(high * 100 + Number(c.word)),
          owners: [...new Set([...a.owners, ...b.owners, ...c.owners])],
        });
        i += 2;
        continue;
      }
    }
    out.push(a);
  }
  return out;
}
