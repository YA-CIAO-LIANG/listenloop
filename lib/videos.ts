/** Shape of data/videos/<id>.json (see CLAUDE.md 資料格式). */

// Imports carry .ts so scripts/new-video.mts can run this with plain Node.
import { excerptSeconds, MIN_EXCERPT_SECONDS } from "./excerpt-length.ts";

export const videoLevels = ["beginner", "intermediate", "advanced"] as const;
/**
 * Collections group the library, in display order. Names and intros live in
 * the translation files (collections.<id>.title / .intro).
 */
export const videoCollections = ["blender-open-movies"] as const;
export const videoCategories = [
  "daily",
  "campus",
  "business",
  "interview",
  "story",
] as const;

/**
 * Only licenses that allow commercial use and derivatives (our Chinese
 * translation is a derivative). NC and ND licenses must never pass.
 */
export const ALLOWED_LICENSE = /^(Public Domain|CC BY(-SA)? \d\.\d)$/;

export type VideoLevel = (typeof videoLevels)[number];
export type VideoCategory = (typeof videoCategories)[number];
export type VideoCollection = (typeof videoCollections)[number];

export type Sentence = {
  /** Zero-based, sequential. */
  i: number;
  /** Seconds into the YouTube video. */
  start: number;
  end: number;
  en: string;
  zh: string;
};

export type VocabItem = {
  /** Index of the sentence this word comes from (sentences[].i). */
  sentence: number;
  word: string;
  pos: string;
  zh: string;
  example: string;
};

export type GrammarPoint = {
  /** Index of the sentence this point comes from (sentences[].i). */
  sentence: number;
  point: string;
  explanation: string;
  example: string;
};

/** Credit shown wherever the video plays (required by CC BY). */
export type Attribution = {
  /** Exact credit line the rights holder asks for. */
  credit: string;
  /** e.g. "CC BY 3.0" or "Public Domain"; must match ALLOWED_LICENSE. */
  license: string;
  /** The license text, e.g. https://creativecommons.org/licenses/by/3.0/ */
  licenseUrl: string;
  /** Official page where the license was verified. */
  sourceUrl: string;
  /** Official transcript or subtitle file the sentences come from. */
  transcriptUrl: string;
  /** What we changed (CC BY requires indicating changes). */
  changes: string;
};

export type Video = {
  id: string;
  youtubeId: string;
  title: string;
  level: VideoLevel;
  category: VideoCategory;
  /** The library group it belongs to, e.g. "blender-open-movies". */
  collection: VideoCollection;
  /** Rights holder's display name, e.g. "Blender Foundation". */
  source: string;
  attribution: Attribution;
  sentences: Sentence[];
  vocab: VocabItem[];
  grammar: GrammarPoint[];
  /**
   * A video still being made: hidden from the library and every page except
   * /videos/<id>/timing, where its timestamps get tuned. Drafts may keep the
   * TODO_ZH placeholder and empty vocab and grammar.
   */
  draft?: boolean;
};

/** Placeholder Chinese in drafts (scripts/new-video.ts); never in a published video. */
export const TODO_ZH = "（待翻譯）";

type Data = Record<string, unknown>;

const isObject = (value: unknown): value is Data =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isText = (value: unknown): value is string =>
  typeof value === "string" && value.trim() !== "";

function checkTextFields(
  item: unknown,
  fields: readonly string[],
  where: string,
  problems: string[],
) {
  if (!isObject(item)) {
    problems.push(`${where} must be an object`);
    return;
  }
  for (const field of fields) {
    if (!isText(item[field])) problems.push(`${where}.${field} must be text`);
  }
}

/**
 * Lists everything wrong with a video file; an empty list means valid.
 * Sentences must be numbered 0, 1, 2… with non-overlapping, increasing times
 * so the player can cut them cleanly.
 */
export function validateVideo(data: unknown): string[] {
  const problems: string[] = [];
  if (!isObject(data)) return ["video must be an object"];

  if (
    typeof data.id !== "string" ||
    !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(data.id)
  ) {
    problems.push("id must be lowercase letters, digits, and dashes");
  }
  if (
    typeof data.youtubeId !== "string" ||
    !/^[A-Za-z0-9_-]{11}$/.test(data.youtubeId)
  ) {
    problems.push("youtubeId must be an 11-character YouTube id");
  }
  for (const field of ["title", "source"]) {
    if (!isText(data[field])) problems.push(`${field} must be text`);
  }

  const attribution = data.attribution;
  checkTextFields(
    attribution,
    [
      "credit",
      "license",
      "licenseUrl",
      "sourceUrl",
      "transcriptUrl",
      "changes",
    ],
    "attribution",
    problems,
  );
  if (isObject(attribution)) {
    if (
      typeof attribution.license === "string" &&
      !ALLOWED_LICENSE.test(attribution.license)
    ) {
      problems.push(
        "attribution.license must be Public Domain, CC BY x.x, or CC BY-SA x.x",
      );
    }
    for (const field of ["licenseUrl", "sourceUrl", "transcriptUrl"]) {
      const url = attribution[field];
      if (typeof url === "string" && !/^https:\/\/\S+$/.test(url)) {
        problems.push(`attribution.${field} must be an https URL`);
      }
    }
  }
  if (!videoLevels.includes(data.level as VideoLevel)) {
    problems.push(`level must be one of ${videoLevels.join(", ")}`);
  }
  if (!videoCategories.includes(data.category as VideoCategory)) {
    problems.push(`category must be one of ${videoCategories.join(", ")}`);
  }
  if (!videoCollections.includes(data.collection as VideoCollection)) {
    problems.push(`collection must be one of ${videoCollections.join(", ")}`);
  }

  if (data.draft !== undefined && typeof data.draft !== "boolean") {
    problems.push("draft must be true or false");
  }
  if (!Array.isArray(data.sentences) || data.sentences.length === 0) {
    problems.push("sentences must be a non-empty list");
  } else {
    let previousEnd = 0;
    data.sentences.forEach((sentence: unknown, index) => {
      const where = `sentences[${index}]`;
      checkTextFields(sentence, ["en", "zh"], where, problems);
      if (!isObject(sentence)) return;
      if (data.draft !== true && sentence.zh === TODO_ZH) {
        problems.push(
          `${where}.zh must be translated (only drafts may say ${TODO_ZH})`,
        );
      }
      if (sentence.i !== index) problems.push(`${where}.i must be ${index}`);
      const { start, end } = sentence;
      if (typeof start !== "number" || typeof end !== "number") {
        problems.push(`${where}.start and .end must be numbers`);
        return;
      }
      if (start < previousEnd) {
        problems.push(`${where}.start must not be before the previous end`);
      }
      if (end <= start) problems.push(`${where}.end must be after start`);
      previousEnd = end;
    });
    // Drafts may run short while their excerpt is still being chosen.
    const seconds = excerptSeconds(data.sentences as Sentence[]);
    if (data.draft !== true && seconds < MIN_EXCERPT_SECONDS) {
      problems.push(
        `excerpt must run at least ${MIN_EXCERPT_SECONDS} s (first start to last end), not ${seconds} s`,
      );
    }
  }

  for (const [list, fields] of [
    ["vocab", ["word", "pos", "zh", "example"]],
    ["grammar", ["point", "explanation", "example"]],
  ] as const) {
    const items = data[list];
    if (!Array.isArray(items)) {
      problems.push(`${list} must be a list`);
      continue;
    }
    const sentenceCount = Array.isArray(data.sentences)
      ? data.sentences.length
      : 0;
    items.forEach((item: unknown, index) => {
      const where = `${list}[${index}]`;
      checkTextFields(item, fields, where, problems);
      if (!isObject(item)) return;
      const { sentence } = item;
      if (
        typeof sentence !== "number" ||
        !Number.isInteger(sentence) ||
        sentence < 0 ||
        sentence >= sentenceCount
      ) {
        problems.push(`${where}.sentence must be a sentence index`);
      }
    });
  }

  return problems;
}

/** The vocabulary and grammar that belong to one sentence, in file order. */
export function notesForSentence(
  video: Pick<Video, "vocab" | "grammar">,
  index: number,
): { vocab: VocabItem[]; grammar: GrammarPoint[] } {
  return {
    vocab: video.vocab.filter((item) => item.sentence === index),
    grammar: video.grammar.filter((point) => point.sentence === index),
  };
}

/** Returns the data as a Video, or throws listing every problem. */
export function parseVideo(data: unknown): Video {
  const problems = validateVideo(data);
  if (problems.length > 0) {
    throw new Error(`Invalid video:\n- ${problems.join("\n- ")}`);
  }
  return data as Video;
}
