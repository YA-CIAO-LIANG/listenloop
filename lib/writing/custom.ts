import type { WritingPrompt } from "./types";

/**
 * A learner's own prompt (D196): a task they typed, or a diary or free
 * writing. Private: kept only in this browser (ll-writing-custom:v1) and,
 * signed in, the account's own documents (`writing-custom`); no one else
 * can list or open it. It has no model essay, so days 2–6 use the
 * learner's own sentences (lib/writing/back-translation.ts).
 */
export const CUSTOM_KINDS = ["custom", "diary", "free"] as const;
export type CustomKind = (typeof CUSTOM_KINDS)[number];

export type CustomPrompt = {
  /** "c-" and a random id; never an official prompt's id. */
  id: string;
  kind: CustomKind;
  /** May be empty: the page then names it by kind and date. */
  title: string;
  /** What to write about (English or Chinese); empty for diary and free. */
  task: string;
  createdAt: string;
  updatedAt: string;
  /** Deleted on some device: kept so the deletion syncs. */
  deleted?: boolean;
};

export const CUSTOM_KEY = "ll-writing-custom:v1";
export const CUSTOM_PREFIX = "c-";
export const MAX_CUSTOM_TITLE = 80;
export const MAX_CUSTOM_TASK = 600;
/** At most this many custom prompts (deleted ones included). */
export const MAX_CUSTOM_PROMPTS = 200;

/** Length targets by kind: a diary is short, free writing open. */
export const CUSTOM_WORDS: Record<CustomKind, { min: number; max: number }> = {
  custom: { min: 80, max: 300 },
  diary: { min: 50, max: 250 },
  free: { min: 50, max: 400 },
};
export const CUSTOM_MINUTES: Record<CustomKind, number> = {
  custom: 20,
  diary: 10,
  free: 15,
};

/** The default task of a diary or free writing, as the AI sees it. */
export const CUSTOM_TASK: Record<Exclude<CustomKind, "custom">, string> = {
  diary:
    "Write a diary entry about your day: what happened, how you felt, and why.",
  free: "Write about anything you like, in your own words.",
};

const ID = /^c-[a-z0-9-]{8,36}$/;
export const isCustomPromptId = (id: string) => ID.test(id);

export const newCustomId = () =>
  `${CUSTOM_PREFIX}${crypto.randomUUID().slice(0, 18)}`;

const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

const clip = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export function parseCustomPrompt(value: unknown): CustomPrompt | null {
  if (!isObject(value)) return null;
  const id = typeof value.id === "string" ? value.id : "";
  const kind = CUSTOM_KINDS.find((k) => k === value.kind);
  if (!isCustomPromptId(id) || !kind) return null;
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : "";
  if (Number.isNaN(Date.parse(createdAt))) return null;
  return {
    id,
    kind,
    title: clip(value.title, MAX_CUSTOM_TITLE),
    task: kind === "custom" ? clip(value.task, MAX_CUSTOM_TASK) : "",
    createdAt,
    updatedAt:
      typeof value.updatedAt === "string" ? value.updatedAt : createdAt,
    ...(value.deleted === true ? { deleted: true } : {}),
  };
}

export function parseCustomPrompts(value: unknown): CustomPrompt[] {
  const list =
    isObject(value) && Array.isArray(value.prompts) ? value.prompts : [];
  return list
    .map(parseCustomPrompt)
    .filter((p): p is CustomPrompt => p !== null)
    .slice(0, MAX_CUSTOM_PROMPTS);
}

/** Two copies (this device, the account): per prompt, the later change. */
export function mergeCustomPrompts(
  a: readonly CustomPrompt[],
  b: readonly CustomPrompt[],
): CustomPrompt[] {
  const byId = new Map<string, CustomPrompt>();
  for (const prompt of [...a, ...b]) {
    const seen = byId.get(prompt.id);
    if (!seen || prompt.updatedAt > seen.updatedAt) byId.set(prompt.id, prompt);
  }
  return [...byId.values()]
    .sort((x, y) => (x.createdAt < y.createdAt ? 1 : -1))
    .slice(0, MAX_CUSTOM_PROMPTS);
}

/** What the learner asked to write about, or the kind's default. */
export const customTask = (prompt: Pick<CustomPrompt, "kind" | "task">) =>
  prompt.kind === "custom" ? prompt.task : CUSTOM_TASK[prompt.kind];

/**
 * The prompt the writing pages use: a daily-kind prompt with the
 * general rubric and no model essay, patterns, or drill items.
 * `name` is the title to show (the learner's, or by kind and date).
 */
export function customWritingPrompt(
  prompt: CustomPrompt,
  name: { en: string; zh: string },
  taskZh: string,
): WritingPrompt {
  return {
    id: prompt.id,
    type: "daily",
    level: "intermediate",
    title: name,
    subtitle: "",
    task: customTask(prompt),
    taskZh,
    words: CUSTOM_WORDS[prompt.kind],
    minutes: CUSTOM_MINUTES[prompt.kind],
    focus: [],
    model: { en: [], zh: [] },
    patterns: [],
    combine: [],
    paraphrase: [],
    custom: prompt.kind,
  };
}
