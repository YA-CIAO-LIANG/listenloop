/** Shape of data/videos/<id>.json (see CLAUDE.md 資料格式). */

export const videoLevels = ["beginner", "intermediate", "advanced"] as const;
export const videoCategories = [
  "daily",
  "campus",
  "business",
  "interview",
] as const;

export type VideoLevel = (typeof videoLevels)[number];
export type VideoCategory = (typeof videoCategories)[number];

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
  word: string;
  pos: string;
  zh: string;
  example: string;
};

export type GrammarPoint = {
  point: string;
  explanation: string;
  example: string;
};

export type Video = {
  id: string;
  youtubeId: string;
  title: string;
  level: VideoLevel;
  category: VideoCategory;
  source: string;
  license: string;
  sentences: Sentence[];
  vocab: VocabItem[];
  grammar: GrammarPoint[];
};

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
  for (const field of ["title", "source", "license"]) {
    if (!isText(data[field])) problems.push(`${field} must be text`);
  }
  if (!videoLevels.includes(data.level as VideoLevel)) {
    problems.push(`level must be one of ${videoLevels.join(", ")}`);
  }
  if (!videoCategories.includes(data.category as VideoCategory)) {
    problems.push(`category must be one of ${videoCategories.join(", ")}`);
  }

  if (!Array.isArray(data.sentences) || data.sentences.length === 0) {
    problems.push("sentences must be a non-empty list");
  } else {
    let previousEnd = 0;
    data.sentences.forEach((sentence: unknown, index) => {
      const where = `sentences[${index}]`;
      checkTextFields(sentence, ["en", "zh"], where, problems);
      if (!isObject(sentence)) return;
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
    items.forEach((item: unknown, index) =>
      checkTextFields(item, fields, `${list}[${index}]`, problems),
    );
  }

  return problems;
}

/** Returns the data as a Video, or throws listing every problem. */
export function parseVideo(data: unknown): Video {
  const problems = validateVideo(data);
  if (problems.length > 0) {
    throw new Error(`Invalid video:\n- ${problems.join("\n- ")}`);
  }
  return data as Video;
}
