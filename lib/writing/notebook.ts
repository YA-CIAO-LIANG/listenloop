import { addDays, isLocalDate, type LocalDate } from "@/lib/dates";
import { isErrorType, type ErrorType } from "./types";

/**
 * "My writing notebook" (D187): mistakes and useful patterns come back 1,
 * 3, and 7 days after they were added (spacing; learning-science.md §3).
 * Recalling one correctly moves it to the next gap; a miss starts over at
 * 1 day. After the 7-day review it's mastered and stops coming back.
 * Stored locally as ll-writing-notebook:v1, and in the account.
 */
export const REVIEW_GAPS = [1, 3, 7] as const;
export const NOTEBOOK_KEY = "ll-writing-notebook:v1";
/** At most this many reviews a day, the oldest due first. */
export const REVIEWS_PER_DAY = 5;

export type NotebookEntry = {
  /** Stable: the same mistake or pattern isn't added twice. */
  id: string;
  /**
   * "chat": from a chat (D197): `text` is the Chinese, `answer` the English.
   * "back": a sentence written back wrong (D199): `text` its Chinese (empty:
   * heard instead), `answer` the English, `note` what was written.
   */
  kind: "error" | "pattern" | "chat" | "back";
  promptId: string;
  /** The learner's sentence (error) or the pattern (pattern). */
  text: string;
  /** The corrected sentence (error) or the model example (pattern). */
  answer: string;
  /** Why, in Chinese. */
  note: string;
  type?: ErrorType;
  /** Reviews passed so far: 0–3 (3 is mastered). */
  stage: number;
  due: LocalDate;
  added: LocalDate;
  /** ISO time of the last change, for merging devices. */
  at: string;
};

export type Notebook = { entries: Record<string, NotebookEntry> };

export const emptyNotebook = (): Notebook => ({ entries: {} });

export const isMastered = (entry: NotebookEntry) =>
  entry.stage >= REVIEW_GAPS.length;

/** Adds what isn't there yet, due tomorrow. */
export function addToNotebook(
  notebook: Notebook,
  items: Omit<NotebookEntry, "stage" | "due" | "added" | "at">[],
  today: LocalDate,
  now: Date = new Date(),
): Notebook {
  const entries = { ...notebook.entries };
  for (const item of items) {
    if (entries[item.id]) continue;
    entries[item.id] = {
      ...item,
      stage: 0,
      due: addDays(today, REVIEW_GAPS[0]),
      added: today,
      at: now.toISOString(),
    };
  }
  return { entries };
}

/** A review's result: on to the next gap, or back to the first. */
export function reviewEntry(
  entry: NotebookEntry,
  remembered: boolean,
  today: LocalDate,
  now: Date = new Date(),
): NotebookEntry {
  const stage = remembered ? entry.stage + 1 : 0;
  const gap = REVIEW_GAPS[Math.min(stage, REVIEW_GAPS.length - 1)];
  return {
    ...entry,
    stage,
    due: addDays(today, remembered ? gap : REVIEW_GAPS[0]),
    at: now.toISOString(),
  };
}

/**
 * Today's reviews, mistakes and patterns of every prompt mixed
 * (interleaving), oldest due first, at most REVIEWS_PER_DAY.
 */
export function dueToday(
  notebook: Notebook,
  today: LocalDate,
): NotebookEntry[] {
  return Object.values(notebook.entries)
    .filter((e) => !isMastered(e) && e.due <= today)
    .sort((a, b) =>
      a.due === b.due ? a.id.localeCompare(b.id) : a.due < b.due ? -1 : 1,
    )
    .slice(0, REVIEWS_PER_DAY);
}

/** Two copies of the notebook: each entry from whichever changed last. */
export function mergeNotebooks(a: Notebook, b: Notebook): Notebook {
  const entries = { ...a.entries };
  for (const [id, entry] of Object.entries(b.entries)) {
    const mine = entries[id];
    if (!mine || entry.at > mine.at) entries[id] = entry;
  }
  return { entries };
}

export function parseNotebook(value: unknown): Notebook {
  if (!value || typeof value !== "object") return emptyNotebook();
  const raw = (value as { entries?: unknown }).entries;
  if (!raw || typeof raw !== "object") return emptyNotebook();
  const entries: Record<string, NotebookEntry> = {};
  for (const [id, e] of Object.entries(raw as Record<string, unknown>)) {
    if (!e || typeof e !== "object") continue;
    const o = e as Record<string, unknown>;
    if (
      !["error", "pattern", "chat", "back"].includes(o.kind as string) ||
      typeof o.text !== "string" ||
      typeof o.answer !== "string" ||
      !isLocalDate(o.due) ||
      !isLocalDate(o.added)
    )
      continue;
    entries[id] = {
      id,
      kind: o.kind as NotebookEntry["kind"],
      promptId: typeof o.promptId === "string" ? o.promptId : "",
      text: o.text,
      answer: o.answer,
      note: typeof o.note === "string" ? o.note : "",
      ...(isErrorType(o.type) ? { type: o.type } : {}),
      stage: Math.max(0, Math.min(REVIEW_GAPS.length, Number(o.stage) || 0)),
      due: o.due,
      added: o.added,
      at: typeof o.at === "string" ? o.at : new Date(0).toISOString(),
    };
  }
  return { entries };
}

/** Patterns learned: reviewed at all three gaps. */
export function masteredPatterns(notebook: Notebook): number {
  return Object.values(notebook.entries).filter(
    (e) => e.kind === "pattern" && isMastered(e),
  ).length;
}

/** A short, stable id for a piece of text. */
function textId(text: string): string {
  let h = 5381;
  for (const ch of text.toLowerCase())
    h = ((h << 5) + h + ch.charCodeAt(0)) | 0;
  return (h >>> 0).toString(36);
}

/** The AI's quoted mistakes (main ones first, at most 5) for the notebook. */
export function errorItems(
  promptId: string,
  issues: readonly {
    quote: string;
    suggestion: string;
    why: string;
    type: ErrorType;
  }[],
) {
  return issues
    .filter((i) => i.quote && i.suggestion)
    .slice(0, 5)
    .map((i) => ({
      id: `e:${promptId}:${textId(i.quote)}`,
      kind: "error" as const,
      promptId,
      text: i.quote,
      answer: i.suggestion,
      note: i.why,
      type: i.type,
    }));
}

/** The prompt's useful patterns for the notebook. */
export function patternItems(
  promptId: string,
  patterns: readonly { pattern: string; example: string; zh: string }[],
) {
  return patterns.map((p, i) => ({
    id: `p:${promptId}:${i}`,
    kind: "pattern" as const,
    promptId,
    text: p.pattern,
    answer: p.example,
    note: p.zh,
  }));
}
