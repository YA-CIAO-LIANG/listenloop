/**
 * WritingLoop (D187): a seven-day writing cycle on one prompt. Everything
 * the writing feature knows about lives under lib/writing/,
 * components/writing/, and app/writing/, so it can move to its own app
 * later; it shares accounts, plans, the AI providers and their meter, the
 * design system, and the practice calendar with ListenLoop.
 */

/** Prompt kinds, in the library's order (D187). */
export const WRITING_TYPES = [
  "daily",
  "diary",
  "email-formal",
  "email-informal",
  "opinion",
  "chart",
  "story",
  "campus-leave",
  "campus-professor",
  "campus-housing",
  "ielts-task1",
  "ielts-task2",
  "toefl",
  "toefl-integrated",
  "gept",
  "gsat",
  "toeic",
  "cap",
] as const;
export type WritingType = (typeof WRITING_TYPES)[number];

/** The library's groups of kinds (its tag buttons). */
export const WRITING_GROUPS = [
  "daily",
  "email",
  "opinion",
  "chart",
  "story",
  "campus",
  "exam",
] as const;
export type WritingGroup = (typeof WRITING_GROUPS)[number];

export const WRITING_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type WritingLevel = (typeof WRITING_LEVELS)[number];

/** How each kind is scored (lib/writing/rubrics.ts). */
export type RubricId =
  "general" | "ielts" | "ielts-task1" | "toefl" | "gept" | "gsat";

export type WritingTypeConfig = {
  group: WritingGroup;
  rubric: RubricId;
};

/** The kinds in one place: their group and how they're scored. */
export const WRITING_TYPE_CONFIG: Readonly<
  Record<WritingType, WritingTypeConfig>
> = {
  daily: { group: "daily", rubric: "general" },
  diary: { group: "daily", rubric: "general" },
  "email-formal": { group: "email", rubric: "general" },
  "email-informal": { group: "email", rubric: "general" },
  opinion: { group: "opinion", rubric: "general" },
  chart: { group: "chart", rubric: "general" },
  story: { group: "story", rubric: "general" },
  "campus-leave": { group: "campus", rubric: "general" },
  "campus-professor": { group: "campus", rubric: "general" },
  "campus-housing": { group: "campus", rubric: "general" },
  "ielts-task1": { group: "exam", rubric: "ielts-task1" },
  "ielts-task2": { group: "exam", rubric: "ielts" },
  toefl: { group: "exam", rubric: "toefl" },
  // Reading + lecture summarized in the task (D215); scored like TOEFL.
  "toefl-integrated": { group: "exam", rubric: "toefl" },
  gept: { group: "exam", rubric: "gept" },
  gsat: { group: "exam", rubric: "gsat" },
  // Scored by the general rubric: a new rubric would change the review
  // prompt and need a new writing eval recording (D213).
  toeic: { group: "exam", rubric: "general" },
  cap: { group: "exam", rubric: "general" },
};

/** A useful sentence pattern from the model essay (3–5 per prompt). */
export type WritingPattern = {
  /** The pattern, e.g. "Not only … but also …". */
  pattern: string;
  /** What it does, in Chinese. */
  zh: string;
  /** The sentence of the model essay that uses it. */
  example: string;
  /**
   * Words a sentence must contain to count as using the pattern
   * (lowercase; any order), for the rule check of the imitation drill.
   */
  keys: string[];
};

/** Short sentences to combine into one (the combining drill). */
export type CombineDrill = { parts: string[]; answer: string };

/** A sentence to say another way (the paraphrasing drill). */
export type ParaphraseDrill = { sentence: string; answers: string[] };

/**
 * An official writing prompt (data/writing/prompts/<id>.json, D187),
 * checked at build and by the tests (lib/writing/validate.ts).
 */
export type WritingPrompt = {
  id: string;
  type: WritingType;
  level: WritingLevel;
  title: { en: string; zh: string };
  /** One line under the title, in Chinese. */
  subtitle: string;
  /** The task as an exam or a teacher would set it, in English. */
  task: string;
  /** The task explained in Chinese. */
  taskZh: string;
  /** For chart prompts: the data to describe, as a small table. */
  chart?: { title: string; columns: string[]; rows: (string | number)[][] };
  words: { min: number; max: number };
  /** Suggested minutes for the first draft. */
  minutes: number;
  /** What the scoring looks at most, in Chinese (2–4 points). */
  focus: string[];
  /** The model essay, by paragraph, with its Chinese translation. */
  model: { en: string[]; zh: string[] };
  patterns: WritingPattern[];
  combine: CombineDrill[];
  paraphrase: ParaphraseDrill[];
  /** A built-in ListenLoop video for the listen-then-write drill. */
  listenVideo?: string;
  draft?: boolean;
  /** Set only on a learner's own prompt (D196): its kind. */
  custom?: "custom" | "diary" | "free";
};

/** Kinds of mistakes, for the notebook and the analytics (D187). */
export const ERROR_TYPES = [
  "grammar",
  "verb",
  "article",
  "preposition",
  "word-choice",
  "spelling",
  "punctuation",
  "sentence",
  "cohesion",
  "organization",
  "task",
  "tone",
] as const;
export type ErrorType = (typeof ERROR_TYPES)[number];

export const isErrorType = (value: unknown): value is ErrorType =>
  (ERROR_TYPES as readonly unknown[]).includes(value);
