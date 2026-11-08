import { PRACTICE_LIMITS } from "./draft";

import {
  findExam,
  findScenario,
  findTarget,
  isLevel,
  LEVEL_PROMPTS,
  type CategoryId,
  type Level,
} from "@/lib/categories";
import { VOICE_ACCENTS, type VoiceAccent } from "@/lib/ai/types";

/**
 * Practice text written by a language model (e+ 5, D36, D57): the learner
 * picks a scenario from lib/categories.ts, a level (or, for exam
 * practice, a target), a length, the form, and an accent, and
 * optionally a topic.
 */

/** Lengths offered, as the library's length buckets (minutes). */
export const GENERATION_LENGTHS = ["1-2", "2-3", "3-4", "4-5"] as const;
export type GenerationLength = (typeof GENERATION_LENGTHS)[number];

/** Azure neural voices read about this many words a minute (D36). */
export const WORDS_PER_MINUTE = 130;

/** The words asked for: the middle of the length bucket. */
export function lengthWords(length: GenerationLength): number {
  const [min, max] = length.split("-").map(Number);
  return Math.round(((min + max) / 2) * WORDS_PER_MINUTE);
}

export const GENERATION_FORMATS = ["dialogue", "monologue"] as const;
export type GenerationFormat = (typeof GENERATION_FORMATS)[number];

export const TOPIC_MAX_CHARS = 200;

/** A situation the learner describes in their own words (D81). */
export const CUSTOM_SCENARIO_MAX_CHARS = 200;

/** How each accent's English is asked for. */
const ACCENT_PROMPTS: Readonly<Record<VoiceAccent, string>> = {
  us: "American English spelling and expressions",
  gb: "British English spelling and expressions",
  au: "Australian English spelling and expressions",
  in: "Indian English expressions, with British spelling",
};

export type GenerationRequest = {
  /** Optional topic or keywords, in any language. */
  topic: string;
  /** A scenario id (lib/categories.ts), or "" with a custom scenario. */
  scenario: string;
  /** The situation in the learner's words (D81), in any language; may be "". */
  customScenario: string;
  /**
   * The learner's title (D81): kept exactly (ends trimmed), never the
   * model's; "" lets the model name it.
   */
  title: string;
  /** A general level, or for exam practice the exam's target id. */
  level: string;
  length: GenerationLength;
  format: GenerationFormat;
  accent: VoiceAccent;
};

/** What the language provider is asked to write (lib/ai/types.ts). */
export type CompositionPrompt = {
  topic: string;
  scenario: string;
  /** The learner's own situation, the main one (D81); only when given. */
  customScenario?: string;
  /** The learner's title, for the text to match (D81); only when given. */
  title?: string;
  level: string;
  words: number;
  format: GenerationFormat;
};

/** Where a written practice belongs, saved with it (D57). */
export type MaterialMeta = {
  category: CategoryId;
  scenario: string;
  level: Level;
  exam: string | null;
  examTarget: string | null;
};

/**
 * Checks a request from the browser. Takes `unknown` because it guards
 * the server action. An exam part needs one of its exam's targets; any
 * other scenario a general level.
 */
export function parseGenerationRequest(
  input: unknown,
): GenerationRequest | null {
  const raw = (input ?? {}) as Record<string, unknown>;
  const tidy = (value: unknown) =>
    typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  const topic = tidy(raw.topic);
  const customScenario = tidy(raw.customScenario);
  // The title as typed: only its ends are trimmed (D81).
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const place = raw.scenario === "" ? null : findScenario(raw.scenario);
  const levelOk = place?.exam
    ? findTarget(place.exam, raw.level) !== null
    : isLevel(raw.level);
  if (
    [...topic].length > TOPIC_MAX_CHARS ||
    [...customScenario].length > CUSTOM_SCENARIO_MAX_CHARS ||
    [...title].length > PRACTICE_LIMITS.titleChars ||
    // A scenario from the list, or one described: at least one of them.
    (!place && (raw.scenario !== "" || !customScenario)) ||
    !levelOk ||
    !(GENERATION_LENGTHS as readonly unknown[]).includes(raw.length) ||
    !(GENERATION_FORMATS as readonly unknown[]).includes(raw.format) ||
    !(VOICE_ACCENTS as readonly unknown[]).includes(raw.accent)
  ) {
    return null;
  }
  return {
    topic,
    scenario: place?.scenario.id ?? "",
    customScenario,
    title,
    level: raw.level as string,
    length: raw.length as GenerationLength,
    format: raw.format as GenerationFormat,
    accent: raw.accent as VoiceAccent,
  };
}

export function compositionPrompt(
  request: GenerationRequest,
): CompositionPrompt {
  const place = findScenario(request.scenario);
  const target = place?.exam ? findTarget(place.exam, request.level) : null;
  const scenario = place?.exam
    ? `${place.scenario.prompt}, ${place.exam.style}`
    : (place?.scenario.prompt ?? "");
  const level = target
    ? target.prompt
    : LEVEL_PROMPTS[isLevel(request.level) ? request.level : "intermediate"];
  return {
    topic: request.topic,
    scenario,
    // Only when given, so a plain request reads exactly as before.
    ...(request.customScenario
      ? { customScenario: request.customScenario }
      : {}),
    ...(request.title ? { title: request.title } : {}),
    level: `${level}; ${ACCENT_PROMPTS[request.accent]}`,
    words: lengthWords(request.length),
    format: request.format,
  };
}

/** The categories a request's text belongs to, for saving (D57). */
export function materialMeta(request: GenerationRequest): MaterialMeta | null {
  const place = findScenario(request.scenario);
  if (!place) return null;
  const target = place.exam ? findTarget(place.exam, request.level) : null;
  return {
    category: place.category,
    scenario: place.scenario.id,
    level: target
      ? target.level
      : isLevel(request.level)
        ? request.level
        : "intermediate",
    exam: place.exam?.id ?? null,
    examTarget: target?.id ?? null,
  };
}

/** A meta from the browser, checked against the categories; null if off. */
export function parseMaterialMeta(input: unknown): MaterialMeta | null {
  if (typeof input !== "object" || input === null) return null;
  const raw = input as Record<string, unknown>;
  const place = findScenario(raw.scenario);
  if (!place || place.category !== raw.category || !isLevel(raw.level)) {
    return null;
  }
  if (place.exam) {
    const exam = findExam(raw.exam);
    if (exam?.id !== place.exam.id || !findTarget(exam, raw.examTarget)) {
      return null;
    }
  } else if (raw.exam !== null || raw.examTarget !== null) {
    return null;
  }
  return {
    category: place.category,
    scenario: place.scenario.id,
    level: raw.level,
    exam: place.exam?.id ?? null,
    examTarget: place.exam ? (raw.examTarget as string) : null,
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
