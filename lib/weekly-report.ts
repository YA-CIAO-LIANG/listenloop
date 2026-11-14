import type { Activity } from "./activity";
import { accuracyTrend } from "./analytics";
import { addDays, type LocalDate } from "./dates";
import { tasksByDate } from "./practice-calendar";
import { daySeconds } from "./practice-time";
import type { Progress } from "./progress";
import { REVIEW_INTERVALS } from "./review";
import { practiceDays, weekStart } from "./streak";

/**
 * The weekly learning report (D176): on Monday the signed-in home page
 * sums up last week (Monday to Sunday) and suggests one thing for this
 * week. Every number and rule is here; the page only shows the result.
 */
export const WEEKLY_REPORT = {
  /** Shown from Monday for this many days (Mon, Tue, Wed), until dismissed. */
  showDays: 3,
  /** Misheard words listed at most. */
  words: 5,
  /** Practice days a week that count as a steady habit. */
  steadyDays: 4,
  /** A drop in weighted accuracy this large (or more) is worth slowing down. */
  accuracyDrop: 0.03,
  /** Weighted accuracy from here on: ready for harder material. */
  levelUpAccuracy: 0.9,
} as const;

/** The one thing suggested for this week, in order of priority. */
export type WeeklySuggestion =
  "comeBack" | "slowDown" | "moreDays" | "review" | "levelUp" | "keepGoing";

export type WeeklyReport = {
  /** Last week's Monday and Sunday. */
  from: LocalDate;
  to: LocalDate;
  /** This week's Monday: what a dismissal is remembered by. */
  week: LocalDate;
  /** Practice time counted (D74), in whole minutes. */
  minutes: number;
  /** Days with practice (an official task or counted time), 0–7. */
  days: number;
  /** Official tasks finished. */
  tasks: number;
  /** Average weighted dictation accuracy (Day 1 and Day 7), or null. */
  accuracy: number | null;
  /** The same for the week before, to compare; null without dictation. */
  previousAccuracy: number | null;
  /** Words misheard in dictation last week, latest first. */
  words: string[];
  suggestion: WeeklySuggestion;
};

const inRange = (date: LocalDate, from: LocalDate, to: LocalDate) =>
  date >= from && date <= to;

function averageAccuracy(
  points: readonly { date: LocalDate; weighted: number }[],
  from: LocalDate,
  to: LocalDate,
): number | null {
  const scores = points
    .filter((p) => inRange(p.date, from, to))
    .map((p) => p.weighted);
  if (scores.length === 0) return null;
  return scores.reduce((sum, n) => sum + n, 0) / scores.length;
}

/**
 * Words misheard last week, from "my misheard words" (D108): a word missed
 * again starts over at stage 0, due the day after it was missed, so that
 * date is when it was last misheard.
 */
function missedWords(
  activity: Activity,
  from: LocalDate,
  to: LocalDate,
): string[] {
  return Object.entries(activity.review ?? {})
    .filter(([, review]) => review.stage === 0)
    .map(([word, review]) => ({
      word,
      missed: addDays(review.due, -REVIEW_INTERVALS[0]),
      at: review.at,
    }))
    .filter((w) => inRange(w.missed, from, to))
    .sort(
      (a, b) =>
        b.missed.localeCompare(a.missed) ||
        b.at.localeCompare(a.at) ||
        a.word.localeCompare(b.word),
    )
    .slice(0, WEEKLY_REPORT.words)
    .map((w) => w.word);
}

function suggest(report: Omit<WeeklyReport, "suggestion">): WeeklySuggestion {
  if (report.days === 0) return "comeBack";
  if (
    report.accuracy !== null &&
    report.previousAccuracy !== null &&
    report.previousAccuracy - report.accuracy >= WEEKLY_REPORT.accuracyDrop
  ) {
    return "slowDown";
  }
  if (report.days < WEEKLY_REPORT.steadyDays) return "moreDays";
  if (report.words.length > 0) return "review";
  if (
    report.accuracy !== null &&
    report.accuracy >= WEEKLY_REPORT.levelUpAccuracy
  ) {
    return "levelUp";
  }
  return "keepGoing";
}

/**
 * Last week's report, or null when it isn't time to show one (only from
 * Monday for WEEKLY_REPORT.showDays days) or there's nothing to report
 * (no practice last week or the week before).
 */
export function weeklyReport(
  progresses: readonly Progress[],
  activity: Activity,
  today: LocalDate,
): WeeklyReport | null {
  const week = weekStart(today);
  if (today >= addDays(week, WEEKLY_REPORT.showDays)) return null;
  const from = addDays(week, -7);
  const to = addDays(week, -1);
  const previousFrom = addDays(week, -14);
  const previousTo = addDays(week, -8);

  const practiced = practiceDays(activity, progresses);
  const days = [...practiced].filter((d) => inRange(d, from, to)).length;
  const daysBefore = [...practiced].filter((d) =>
    inRange(d, previousFrom, previousTo),
  ).length;
  if (days === 0 && daysBefore === 0) return null;

  let seconds = 0;
  for (let i = 0; i < 7; i++) {
    seconds += daySeconds(activity.days[addDays(from, i)]);
  }
  let tasks = 0;
  for (const [date, list] of tasksByDate(activity, progresses)) {
    if (inRange(date, from, to)) tasks += list.length;
  }
  const trend = accuracyTrend(progresses, activity);

  const report = {
    from,
    to,
    week,
    minutes: Math.round(seconds / 60),
    days,
    tasks,
    accuracy: averageAccuracy(trend, from, to),
    previousAccuracy: averageAccuracy(trend, previousFrom, previousTo),
    words: missedWords(activity, from, to),
  };
  return { ...report, suggestion: suggest(report) };
}

/** Where a dismissed week is remembered on this device. */
export const WEEKLY_REPORT_DISMISSED_KEY = "ll-weekly-report-dismissed:v1";
