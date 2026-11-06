import { PRACTICE_LIMITS } from "./draft";

/**
 * Practice text written by a language model (e+ 5, D36): the learner picks
 * a scenario, level, length, and format, and optionally a topic. All the
 * choices live here; add a category or scenario by adding it below and
 * its names to the message files (generate.categories / .scenarios).
 * Each scenario's `prompt` is what the model is asked to write about.
 */
export const GENERATION_CATEGORIES = [
  {
    id: "daily-life",
    scenarios: [
      { id: "restaurant", prompt: "ordering food at a restaurant" },
      { id: "shopping", prompt: "shopping in a store" },
      {
        id: "directions",
        prompt: "asking for directions and using transportation",
      },
      { id: "doctor", prompt: "seeing a doctor" },
      { id: "renting", prompt: "renting an apartment" },
    ],
  },
  {
    id: "study-abroad",
    scenarios: [
      {
        id: "bank-account",
        prompt: "opening a bank account as an international student",
      },
      { id: "roommates", prompt: "talking things through with a roommate" },
      {
        id: "school-office",
        prompt:
          "sorting out paperwork at a university office (registration, visas, housing)",
      },
      {
        id: "part-time-interview",
        prompt: "a job interview for a part-time job while studying abroad",
      },
    ],
  },
  {
    id: "casual-american",
    scenarios: [
      {
        id: "friends-chat",
        prompt: "friends chatting casually in American English",
      },
      {
        id: "slang",
        prompt:
          "everyday American slang and popular expressions, used naturally in conversation",
      },
      {
        id: "social-media",
        prompt:
          "talking about social media, with common social media expressions",
      },
    ],
  },
  {
    id: "campus",
    scenarios: [
      { id: "class-discussion", prompt: "a class discussion at a university" },
      {
        id: "office-hours",
        prompt: "a student visiting a professor's office hours",
      },
      {
        id: "group-presentation",
        prompt: "students planning and giving a group presentation",
      },
    ],
  },
  {
    id: "academic-writing",
    scenarios: [
      { id: "abstract", prompt: "the abstract of a research paper" },
      {
        id: "academic-paragraph",
        prompt: "paragraphs from an academic article",
      },
    ],
  },
  {
    id: "business",
    scenarios: [
      { id: "job-interview", prompt: "a job interview at a company" },
      { id: "meeting", prompt: "a work meeting" },
      {
        id: "phone-email",
        prompt: "a business phone call, or an email read aloud",
      },
      { id: "presentation", prompt: "a business presentation" },
    ],
  },
  {
    id: "talks-stories",
    scenarios: [
      { id: "ted-talk", prompt: "a TED-style talk" },
      { id: "personal-story", prompt: "a personal story told aloud" },
      {
        id: "news-report",
        prompt: "a news report (invented, not about real current events)",
      },
    ],
  },
  {
    id: "exam",
    scenarios: [
      {
        id: "ielts",
        prompt: "an IELTS-style listening conversation or lecture",
      },
      {
        id: "toefl",
        prompt: "a TOEFL-style campus conversation or academic lecture",
      },
    ],
  },
] as const;

export type GenerationCategory = (typeof GENERATION_CATEGORIES)[number];
export type GenerationScenario = GenerationCategory["scenarios"][number];

export const GENERATION_LEVELS = {
  beginner: "CEFR A2: short sentences, the most common words",
  intermediate: "CEFR B1: everyday vocabulary, some longer sentences",
  advanced: "CEFR B2 to C1: natural, varied vocabulary and sentence structure",
} as const;
export type GenerationLevel = keyof typeof GENERATION_LEVELS;

/** About how many minutes the audio runs, like the library's length filter. */
export const GENERATION_MINUTES = [1, 3, 5] as const;
export type GenerationMinutes = (typeof GENERATION_MINUTES)[number];

/** Chirp 3 HD reads about this many words a minute (D36). */
export const WORDS_PER_MINUTE = 130;

export const GENERATION_FORMATS = ["dialogue", "monologue"] as const;
export type GenerationFormat = (typeof GENERATION_FORMATS)[number];

export const TOPIC_MAX_CHARS = 200;

export type GenerationRequest = {
  /** Optional topic or keywords, in any language. */
  topic: string;
  scenario: GenerationScenario["id"];
  level: GenerationLevel;
  minutes: GenerationMinutes;
  format: GenerationFormat;
};

/** What the language provider is asked to write (lib/ai/types.ts). */
export type CompositionPrompt = {
  topic: string;
  scenario: string;
  level: string;
  words: number;
  format: GenerationFormat;
};

export function findScenario(id: unknown): GenerationScenario | null {
  for (const category of GENERATION_CATEGORIES) {
    for (const scenario of category.scenarios) {
      if (scenario.id === id) return scenario;
    }
  }
  return null;
}

/**
 * Checks a request from the browser. Takes `unknown` because it guards
 * the server action.
 */
export function parseGenerationRequest(
  input: unknown,
): GenerationRequest | null {
  const raw = (input ?? {}) as Record<string, unknown>;
  const topic =
    typeof raw.topic === "string" ? raw.topic.replace(/\s+/g, " ").trim() : "";
  const scenario = findScenario(raw.scenario);
  if (
    [...topic].length > TOPIC_MAX_CHARS ||
    !scenario ||
    typeof raw.level !== "string" ||
    !(raw.level in GENERATION_LEVELS) ||
    !(GENERATION_MINUTES as readonly unknown[]).includes(raw.minutes) ||
    !(GENERATION_FORMATS as readonly unknown[]).includes(raw.format)
  ) {
    return null;
  }
  return {
    topic,
    scenario: scenario.id,
    level: raw.level as GenerationLevel,
    minutes: raw.minutes as GenerationMinutes,
    format: raw.format as GenerationFormat,
  };
}

export function compositionPrompt(
  request: GenerationRequest,
): CompositionPrompt {
  return {
    topic: request.topic,
    scenario: findScenario(request.scenario)?.prompt ?? "",
    level: GENERATION_LEVELS[request.level],
    words: request.minutes * WORDS_PER_MINUTE,
    format: request.format,
  };
}

export type GeneratedText = { title: string; text: string };

const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

/**
 * The model's text if it's usable: a title and English lines (one sentence
 * or one speaker's turn each), at least 40% of the words asked for, and
 * within the upload limit. Null otherwise.
 */
export function checkGeneratedText(
  raw: unknown,
  words: number,
): GeneratedText | null {
  const value = (raw ?? {}) as { title?: unknown; lines?: unknown };
  const title =
    typeof value.title === "string"
      ? value.title.replace(/\s+/g, " ").trim()
      : "";
  const lines = Array.isArray(value.lines)
    ? value.lines
        .filter((line): line is string => typeof line === "string")
        .map((line) => line.replace(/\s+/g, " ").trim())
        .filter((line) => /[A-Za-z]/.test(line))
    : [];
  const text = lines.join("\n");
  if (
    !title ||
    [...title].length > PRACTICE_LIMITS.titleChars ||
    lines.length === 0 ||
    wordCount(text) < words * 0.4 ||
    [...text].length > PRACTICE_LIMITS.textChars
  ) {
    return null;
  }
  return { title, text };
}
