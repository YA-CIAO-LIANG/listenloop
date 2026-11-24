import type { LocalDate } from "@/lib/dates";
import { scoreDictation } from "@/lib/scoring/dictation";
import { normalizeWords } from "@/lib/scoring/normalize";
import type { WritingLog } from "./log";
import type { Notebook } from "./notebook";
import type { WritingProgress } from "./progress";

/**
 * The evening review (D203, learning-science.md §13): on a day with
 * writing practice, after the time the learner set, three sentences
 * learned that day written from memory (free recall), then compared
 * with what was practised. Rule-checked; no AI.
 */
export const RECALL_COUNT = 3;
/** A recalled sentence counts as one of the day's at this accuracy. */
export const RECALL_PASS = 0.6;

const reviewId = (date: LocalDate) => `r:${date}`;

/** "HH:MM" of a time on the learner's clock. */
const clock = (now: Date) =>
  `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

/**
 * Whether to remind about the evening review now: turned on, past the
 * time, something practised today, not reviewed yet today.
 */
export function bedtimeDue({
  on,
  at,
  now,
  today,
  log,
  sentences,
}: {
  on: boolean;
  at: string;
  now: Date;
  today: LocalDate;
  log: WritingLog;
  /** Today's sentences (todaysSentences): nothing to recall, no review. */
  sentences: readonly string[];
}): boolean {
  if (!on || clock(now) < at || sentences.length === 0) return false;
  return !log.entries[reviewId(today)];
}

/**
 * The English sentences practised today (D203): every sentence answered
 * today (each day's set and extra practice), and what went to the
 * notebook today; each once.
 */
export function todaysSentences(
  progresses: readonly WritingProgress[],
  notebook: Notebook,
  today: LocalDate,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (en: string) => {
    const k = normalizeWords(en).join(" ");
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.push(en);
  };
  for (const p of progresses) {
    for (const day of [2, 3, 4, 5, 6] as const) {
      const record = p.days[day];
      for (const run of [record?.back, record?.extra]) {
        run?.items.forEach((item, i) => {
          const a = run.answers[i];
          // Answered today (older answers have no date: the day's).
          if (a && (a.date ?? record?.date) === today) add(item.en);
        });
      }
    }
  }
  for (const entry of Object.values(notebook.entries)) {
    // Every kind keeps the English to learn in `answer`.
    if (entry.added === today) add(entry.answer);
  }
  return out;
}

/** Each recalled sentence's closest of today's, and whether it counts. */
export function matchRecall(
  recalled: readonly string[],
  sentences: readonly string[],
): { text: string; match: string | null; score: number }[] {
  return recalled
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text) => {
      let best: string | null = null;
      let score = 0;
      for (const en of sentences) {
        const s = scoreDictation(en, text).accuracy;
        if (s > score) {
          score = s;
          best = en;
        }
      }
      return { text, match: score >= RECALL_PASS ? best : null, score };
    });
}

/** The log with today's evening review done. */
export function logReview(
  log: WritingLog,
  today: LocalDate,
  recalled: number,
  now: Date = new Date(),
): WritingLog {
  const id = reviewId(today);
  return {
    entries: {
      ...log.entries,
      [id]: {
        id,
        kind: "review",
        date: today,
        percent: Math.round(
          (Math.min(recalled, RECALL_COUNT) / RECALL_COUNT) * 100,
        ),
        at: now.toISOString(),
      },
    },
  };
}
