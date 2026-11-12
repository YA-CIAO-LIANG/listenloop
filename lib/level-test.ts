import { LEVELS, type Level } from "./categories";
import { normalizeWords } from "./scoring/normalize";
import { scoreDictation, totalAccuracy } from "./scoring/dictation";

/**
 * The level test (D109): a 2–3 minute dictation of LEVEL_TEST_PER_LEVEL
 * sentences at each level, easiest first, taken from published official
 * materials. Scored like dictation; a level is reached at LEVEL_PASS
 * (60%, D146) and the result is the hardest level reached in a row from
 * the easiest. It's the starting level: the library opens filtered to it
 * (unless the learner saved a default of their own), and the first
 * material is the library's first official material at that level. No
 * AI, nothing sent anywhere: the result stays on this device.
 */
export const LEVEL_TEST_PER_LEVEL = 2;

/** A level is reached at this weighted accuracy or more (D146). */
export const LEVEL_PASS = 0.6;

/** Sentence lengths (words) that suit a test sentence at each level. */
export const LEVEL_TEST_WORDS: Readonly<Record<Level, [number, number]>> = {
  beginner: [5, 10],
  intermediate: [9, 16],
  advanced: [14, 26],
};

export type LevelTestSentence = {
  /** The material it's from. */
  from: string;
  level: Level;
  en: string;
  zh: string;
  audioUrl: string;
};

/** A candidate material: its level and its sentences with audio. */
export type LevelTestSource = {
  /** The material's id ("p-<uuid>"). */
  id: string;
  level: Level;
  sentences: { en: string; zh: string; audioUrl: string | null }[];
};

/**
 * The test: for each level, the first fitting sentences (by length, with
 * audio), one per material when it can, in the order the materials come.
 */
export function pickLevelTest(
  sources: readonly LevelTestSource[],
  perLevel = LEVEL_TEST_PER_LEVEL,
): LevelTestSentence[] {
  const out: LevelTestSentence[] = [];
  for (const level of LEVELS) {
    const [min, max] = LEVEL_TEST_WORDS[level];
    const picked: LevelTestSentence[] = [];
    for (const source of sources) {
      if (source.level !== level || picked.length >= perLevel) continue;
      const fit = source.sentences.find((s) => {
        const words = normalizeWords(s.en).length;
        return s.audioUrl && words >= min && words <= max;
      });
      if (fit?.audioUrl) {
        picked.push({
          from: source.id,
          level,
          en: fit.en,
          zh: fit.zh,
          audioUrl: fit.audioUrl,
        });
      }
    }
    out.push(...picked);
  }
  return out;
}

export type LevelTestResult = {
  /** Weighted accuracy at each level tested. */
  scores: Partial<Record<Level, number>>;
  level: Level;
};

/** Scores the answers (in the test's order) and picks the level. */
export function scoreLevelTest(
  sentences: readonly LevelTestSentence[],
  answers: readonly string[],
): LevelTestResult {
  const scores: Partial<Record<Level, number>> = {};
  for (const level of LEVELS) {
    const results = sentences.flatMap((s, i) =>
      s.level === level ? [scoreDictation(s.en, answers[i] ?? "")] : [],
    );
    if (results.length) scores[level] = totalAccuracy(results);
  }
  let level: Level = LEVELS[0];
  for (const candidate of LEVELS) {
    const score = scores[candidate];
    if (score === undefined) continue;
    if (score >= LEVEL_PASS) level = candidate;
    else break;
  }
  return { scores, level };
}

/**
 * The first material to recommend at `level`: the first one in the
 * library's order not used by the test (so it's new), else the first.
 */
export function recommendMaterial(
  sources: readonly LevelTestSource[],
  level: Level,
  test: readonly LevelTestSentence[],
): string | null {
  const used = new Set(test.map((s) => s.from));
  const atLevel = sources.filter((s) => s.level === level);
  return (atLevel.find((s) => !used.has(s.id)) ?? atLevel[0])?.id ?? null;
}

/** This device's last result (ll-level-test:v1). */
export const LEVEL_TEST_KEY = "ll-level-test:v1";

export type SavedLevelTest = LevelTestResult & { date: string };

export function parseSavedLevelTest(raw: string | null): SavedLevelTest | null {
  try {
    const data = JSON.parse(raw ?? "null") as Partial<SavedLevelTest> | null;
    if (
      data &&
      (LEVELS as readonly unknown[]).includes(data.level) &&
      typeof data.date === "string" &&
      typeof data.scores === "object"
    ) {
      return data as SavedLevelTest;
    }
  } catch {
    // Not JSON: no result.
  }
  return null;
}
