import { missedPieces, missedWords } from "./custom-practice/marks";
import type { RichNotes } from "./custom-practice/rich-notes";
import { blankOut, REVIEW_SKIP_WORDS, reviewKey, type Miss } from "./review";
import type { Sentence, VocabItem } from "./videos";

/**
 * The vocabulary quiz after dictation (D136): words from the material's
 * notes, the ones misheard first; each is spelled from its sound, then
 * matched with its Chinese. The pure parts live here.
 */
export const QUIZ = {
  /** Words a quiz has, at least (when the material has that many). */
  min: 5,
  /** And at most. */
  max: 10,
  /** Answers to choose from in the second step. */
  choices: 4,
  /** "Slowly" plays the word at this speed. */
  slowRate: 0.7,
  /** Other materials' words offered to the page, per part of speech. */
  poolPerPos: 40,
} as const;

/**
 * Words a quiz never asks: articles, pronouns, prepositions, conjunctions,
 * forms of be and do, and the helping verbs (plus the review list's).
 */
export const FUNCTION_WORDS: ReadonlySet<string> = new Set([
  ...REVIEW_SKIP_WORDS,
  ..."a an the this that these those i me my mine we us you your he him she it they them their what which who whom whose when where why how and or but nor so yet if than then because as of at by for from in into on onto to with without about over under up down out off is am are was were be been being do does did have has had will would shall should can could may might must not no yes".split(
    " ",
  ),
]);

export type QuizWord = {
  /** As spelled in the answer key. */
  word: string;
  pos: string;
  zh: string;
  /** The sentence it's from (an index into the material's sentences). */
  sentence: number;
  /** An example sentence and, from version 2 notes, its Chinese. */
  example?: { en: string; zh?: string };
  /** How it appears in its sentence, when that's different (moved/move). */
  inSentence?: string;
};

/** A single word a learner can spell: letters, with ' or - inside. */
const SPELLABLE = /^[A-Za-z]+(?:['’-][A-Za-z]+)*$/;

export function isQuizzable(word: string): boolean {
  const key = reviewKey(word);
  return (
    SPELLABLE.test(word) &&
    key.replace(/[^a-z]/g, "").length >= 3 &&
    !FUNCTION_WORDS.has(key)
  );
}

/**
 * Every word in the material's notes that can be quizzed, once each:
 * version 2 notes first (they have the example's Chinese), then the
 * first-format notes; in sentence order.
 */
export function quizCandidates(material: {
  vocab: readonly VocabItem[];
  richNotes?: readonly (RichNotes | null)[];
}): QuizWord[] {
  const seen = new Set<string>();
  const words: QuizWord[] = [];
  const add = (word: QuizWord) => {
    const key = reviewKey(word.word);
    if (seen.has(key) || !isQuizzable(word.word)) return;
    if (!word.pos.trim() || !word.zh.trim()) return;
    seen.add(key);
    words.push(word);
  };
  (material.richNotes ?? []).forEach((notes, sentence) => {
    for (const item of notes?.vocab ?? []) {
      if (item.kind !== "word") continue;
      const example = item.examples[0];
      add({
        word: item.term,
        pos: item.pos,
        zh: item.zh,
        sentence,
        ...(example ? { example: { en: example.en, zh: example.zh } } : {}),
        ...(item.inSentence && item.inSentence !== item.term
          ? { inSentence: item.inSentence }
          : {}),
      });
    }
  });
  for (const item of material.vocab) {
    add({
      word: item.word,
      pos: item.pos,
      zh: item.zh,
      sentence: item.sentence,
      ...(item.example ? { example: { en: item.example } } : {}),
    });
  }
  return words.sort((a, b) => a.sentence - b.sentence);
}

/** The words misheard in a day's answers, lowercased. */
export function misheardWords(
  sentences: readonly Pick<Sentence, "en">[],
  answers: readonly (string | null)[] | undefined,
): Set<string> {
  const missed = new Set<string>();
  sentences.forEach((sentence, i) => {
    const answer = answers?.[i];
    if (typeof answer !== "string") return;
    for (const word of missedWords(
      sentence.en,
      missedPieces(sentence.en, answer),
    )) {
      missed.add(reviewKey(word));
    }
  });
  return missed;
}

/**
 * The quiz's words: the misheard ones first, then the material's other
 * key words in sentence order, QUIZ.min–QUIZ.max of them (fewer when the
 * material doesn't have that many).
 */
export function pickQuizWords(
  candidates: readonly QuizWord[],
  missed: ReadonlySet<string>,
  max: number = QUIZ.max,
): QuizWord[] {
  const isMissed = (word: QuizWord) =>
    missed.has(reviewKey(word.word)) ||
    (word.inSentence !== undefined &&
      word.inSentence.split(/\s+/).some((part) => missed.has(reviewKey(part))));
  const first = candidates.filter(isMissed);
  const rest = candidates.filter((word) => !isMissed(word));
  return [...first, ...rest].slice(0, max);
}

/** A seeded shuffle, so the same quiz offers the same order. */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  let state = 2166136261;
  for (const char of seed)
    state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  const next = () => {
    state = Math.imul(state ^ (state >>> 15), 2246822507);
    state = Math.imul(state ^ (state >>> 13), 3266489909);
    return ((state ^= state >>> 16) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export type PoolWord = { word: string; pos: string; zh: string };

const samePos = (a: string, b: string) =>
  a.replace(/\.$/, "").toLowerCase() === b.replace(/\.$/, "").toLowerCase();

/**
 * Three wrong answers for `target` (no AI): this material's words of the
 * same part of speech first, then its other words, then other materials'
 * of the same part of speech, then any; never the right Chinese twice.
 */
export function distractors(
  target: PoolWord,
  material: readonly PoolWord[],
  others: readonly PoolWord[],
  count: number = QUIZ.choices - 1,
): string[] {
  const chosen: string[] = [];
  const used = new Set([target.zh.trim()]);
  const take = (pool: readonly PoolWord[]) => {
    for (const word of seededShuffle(pool, target.word)) {
      if (chosen.length >= count) return;
      const zh = word.zh.trim();
      if (
        !zh ||
        used.has(zh) ||
        reviewKey(word.word) === reviewKey(target.word)
      )
        continue;
      used.add(zh);
      chosen.push(zh);
    }
  };
  take(material.filter((w) => samePos(w.pos, target.pos)));
  take(material.filter((w) => !samePos(w.pos, target.pos)));
  take(others.filter((w) => samePos(w.pos, target.pos)));
  take(others);
  return chosen;
}

/** The four answers in a fixed order for this word. */
export function choicesFor(
  target: PoolWord,
  wrong: readonly string[],
): string[] {
  return seededShuffle([target.zh, ...wrong], `${target.word}:choices`);
}

/** One letter of the right spelling, or one typed too many. */
export type LetterMark = {
  char: string;
  /** right; wrong (another letter typed here); missing; extra (typed, not in the word). */
  kind: "right" | "wrong" | "missing" | "extra";
};

const normalizeSpelling = (text: string) =>
  text.trim().toLowerCase().replace(/[‘’]/g, "'");

/**
 * Compares a typed spelling with the word, ignoring case and spaces at
 * the ends: correct or not, and letter by letter where it differs (the
 * fewest changes, as an edit distance).
 */
export function compareSpelling(
  word: string,
  typed: string,
): { correct: boolean; marks: LetterMark[] } {
  const a = [...normalizeSpelling(word)];
  const b = [...normalizeSpelling(typed)];
  const shown = [...word.trim()];
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) =>
      i === 0 ? j : j === 0 ? i : 0,
    ),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  const marks: LetterMark[] = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 || j > 0) {
    if (
      i > 0 &&
      j > 0 &&
      d[i][j] === d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
    ) {
      marks.push({
        char: shown[i - 1] ?? a[i - 1],
        kind: a[i - 1] === b[j - 1] ? "right" : "wrong",
      });
      i--;
      j--;
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      marks.push({ char: shown[i - 1] ?? a[i - 1], kind: "missing" });
      i--;
    } else {
      marks.push({ char: b[j - 1], kind: "extra" });
      j--;
    }
  }
  marks.reverse();
  return { correct: d[a.length][b.length] === 0 && a.length > 0, marks };
}

/** The first hint shows how many letters; the second, the first letter too. */
export function spellingHint(word: string, level: 0 | 1 | 2): string | null {
  if (level === 0) return null;
  const letters = [...word.trim()];
  return letters
    .map((char, i) =>
      i === 0 && level === 2 ? char : /[A-Za-z]/.test(char) ? "_" : char,
    )
    .join(" ");
}

export type WordResult = {
  word: string;
  spelled: boolean;
  /** Hints used for the spelling (0–2). */
  hints: number;
  translated: boolean;
};

export type QuizSummary = {
  total: number;
  spelled: number;
  translated: number;
  hints: number;
  /** Wrong in either step. */
  missed: string[];
};

export function quizSummary(results: readonly WordResult[]): QuizSummary {
  return {
    total: results.length,
    spelled: results.filter((r) => r.spelled).length,
    translated: results.filter((r) => r.translated).length,
    hints: results.reduce((sum, r) => sum + r.hints, 0),
    missed: results
      .filter((r) => !r.spelled || !r.translated)
      .map((r) => r.word),
  };
}

/** A quiz's accuracy, 0–1: both steps of every word. */
export const quizAccuracy = (summary: {
  total: number;
  spelled: number;
  translated: number;
}) =>
  summary.total > 0
    ? (summary.spelled + summary.translated) / (2 * summary.total)
    : 0;

/**
 * The words missed in a quiz, for the review list (D108): each with the
 * sentence it's from, as heard there (the form in the sentence, so the
 * review can blank it out). A word its sentence doesn't contain is left
 * out (the review couldn't ask it).
 */
export function quizMisses(
  words: readonly QuizWord[],
  missed: readonly string[],
  material: {
    id: string;
    sentences: readonly Pick<Sentence, "en" | "zh">[];
    audioUrls?: readonly string[];
    audioClips?: true;
  },
): Miss[] {
  const keys = new Set(missed.map(reviewKey));
  return words.flatMap((word) => {
    if (!keys.has(reviewKey(word.word))) return [];
    const sentence = material.sentences[word.sentence];
    if (!sentence) return [];
    const form = [word.inSentence, word.word].find(
      (candidate) => candidate && blankOut(sentence.en, candidate),
    );
    if (!form) return [];
    const audio = material.audioClips
      ? undefined
      : material.audioUrls?.[word.sentence];
    return [
      {
        en: sentence.en,
        zh: sentence.zh,
        videoId: material.id,
        i: word.sentence,
        word: form,
        ...(audio ? { audio } : {}),
      },
    ];
  });
}
