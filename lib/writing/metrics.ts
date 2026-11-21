/**
 * Rule-based measures of an essay (D194), for comparing Day 1 and Day 7
 * when they have no scores to compare (saved without AI review and
 * without scoring oneself). No AI: counts only.
 */
export type EssayMetrics = {
  words: number;
  sentences: number;
  /** Average words per sentence, one decimal. */
  sentenceWords: number;
  /**
   * Variety of words, 0–100: the moving-average type-token ratio over
   * windows of 50 words (MATTR, Covington & McFall 2010), so a longer
   * essay isn't marked down for repeating "the"; the plain ratio when
   * shorter than one window.
   */
  diversity: number;
};

export const MATTR_WINDOW = 50;

/** Sentence length counts as better up to this many words on average. */
export const SENTENCE_WORDS_CAP = 22;

/** Day 7 passes on these measures when this many of the three improved. */
export const METRICS_TO_PASS = 2;

const wordsOf = (text: string) =>
  text.toLowerCase().match(/[a-z]+(?:['’-][a-z]+)*|\d+(?:[.,]\d+)*/g) ?? [];

export function essayMetrics(text: string): EssayMetrics {
  const words = wordsOf(text);
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .filter((s) => wordsOf(s).length > 0).length;
  let diversity = 0;
  if (words.length > 0) {
    if (words.length <= MATTR_WINDOW) {
      diversity = new Set(words).size / words.length;
    } else {
      let sum = 0;
      const windows = words.length - MATTR_WINDOW + 1;
      for (let i = 0; i < windows; i++) {
        sum += new Set(words.slice(i, i + MATTR_WINDOW)).size / MATTR_WINDOW;
      }
      diversity = sum / windows;
    }
  }
  return {
    words: words.length,
    sentences,
    sentenceWords:
      sentences > 0 ? Math.round((words.length / sentences) * 10) / 10 : 0,
    diversity: Math.round(diversity * 100),
  };
}

export const METRIC_IDS = ["words", "sentenceWords", "diversity"] as const;
export type MetricId = (typeof METRIC_IDS)[number];

export type MetricsComparison = {
  rows: { id: MetricId; day1: number; day7: number; better: boolean }[];
  improved: number;
  passed: boolean;
};

/**
 * Day 1 against Day 7 on the three measures: more words; longer
 * sentences on average, up to SENTENCE_WORDS_CAP (longer than that
 * isn't better writing); more varied words. Passed when at least
 * METRICS_TO_PASS improved.
 */
export function compareMetrics(day1: string, day7: string): MetricsComparison {
  const a = essayMetrics(day1);
  const b = essayMetrics(day7);
  const cap = (n: number) => Math.min(n, SENTENCE_WORDS_CAP);
  const rows = [
    {
      id: "words" as const,
      day1: a.words,
      day7: b.words,
      better: b.words > a.words,
    },
    {
      id: "sentenceWords" as const,
      day1: a.sentenceWords,
      day7: b.sentenceWords,
      better: cap(b.sentenceWords) > cap(a.sentenceWords),
    },
    {
      id: "diversity" as const,
      day1: a.diversity,
      day7: b.diversity,
      better: b.diversity > a.diversity,
    },
  ];
  const improved = rows.filter((r) => r.better).length;
  return { rows, improved, passed: improved >= METRICS_TO_PASS };
}
