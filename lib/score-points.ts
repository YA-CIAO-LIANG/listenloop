import type { Activity, PracticeTask } from "./activity";
import type { DayRecord } from "./progress";
import { scoreDictation } from "./scoring/dictation";
import type { Sentence } from "./videos";
import type { LocalDate } from "./dates";
import { tasksByDate } from "./practice-calendar";
import type { Progress } from "./progress";

/**
 * Practice score (D93): what a day's practice earns, in one place. The
 * score is worked out from the practice records every time (it never goes
 * down and needs no ledger), and unlocks accent colors (lib/accents.ts).
 */
export const SCORE_RULES = {
  /** Each finished official day (Day 1–7 of any practice). */
  day: 10,
  /** Each sentence at 100% in that official day (dictation or shadowing). */
  perfectSentence: 2,
  /** Days in a row with an official task: from the 2nd day on, each day. */
  streakFrom: 2,
  streakBonus: 5,
} as const;

export type ScoreEntry =
  | { kind: "day"; date: LocalDate; amount: number; task: PracticeTask }
  | {
      kind: "perfect";
      date: LocalDate;
      amount: number;
      task: PracticeTask;
      count: number;
    }
  | { kind: "streak"; date: LocalDate; amount: number; days: number };

/** Days apart between two local dates (b after a). */
function daysBetween(a: LocalDate, b: LocalDate): number {
  const [ya, ma, da] = a.split("-").map(Number);
  const [yb, mb, db] = b.split("-").map(Number);
  return Math.round(
    (Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86_400_000,
  );
}

/** Every score entry the records support, oldest first. */
export function scoreEntries(
  activity: Activity,
  progresses: readonly Progress[],
): ScoreEntry[] {
  const byDate = [...tasksByDate(activity, progresses)].sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const entries: ScoreEntry[] = [];
  let run = 0;
  byDate.forEach(([date, tasks], i) => {
    for (const task of tasks) {
      entries.push({ kind: "day", date, amount: SCORE_RULES.day, task });
      if (task.perfect) {
        entries.push({
          kind: "perfect",
          date,
          amount: task.perfect * SCORE_RULES.perfectSentence,
          task,
          count: task.perfect,
        });
      }
    }
    run = i > 0 && daysBetween(byDate[i - 1][0], date) === 1 ? run + 1 : 1;
    if (run >= SCORE_RULES.streakFrom) {
      entries.push({
        kind: "streak",
        date,
        amount: SCORE_RULES.streakBonus,
        days: run,
      });
    }
  });
  return entries;
}

export function totalScore(entries: readonly ScoreEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.amount, 0);
}

/**
 * Sentences at 100% in a finished official day (D93): dictation answers
 * with every word right, or shadowed sentences heard in full.
 */
export function perfectSentences(
  record: DayRecord | undefined,
  sentences: readonly Pick<Sentence, "en">[],
): number {
  if (!record) return 0;
  if (record.answers) {
    return record.answers.filter(
      (answer, i) =>
        answer !== null &&
        sentences[i] !== undefined &&
        scoreDictation(sentences[i].en, answer).accuracy === 1,
    ).length;
  }
  return (record.sentences ?? []).filter((s) => s.coverage === 1).length;
}
