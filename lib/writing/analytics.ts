import type { Activity } from "@/lib/activity";
import { lastDays } from "@/lib/analytics";
import { addDays, type LocalDate } from "@/lib/dates";
import {
  daySeconds,
  isWritingTimeId,
  practiceMinutes,
} from "@/lib/practice-time";
import { reportWeek } from "@/lib/weekly-report";
import { writingPracticeDays, type WritingCalendarDay } from "./log";
import { masteredPatterns, type Notebook } from "./notebook";
import { essayPercent, type EssayDay, type WritingProgress } from "./progress";
import { RUBRICS, type CriterionId } from "./rubrics";
import type { ErrorType } from "./types";

/**
 * WritingLoop in the learning stats and the weekly report (D189): every
 * number comes from the learner's own progress and notebook (this
 * device, synced with the account), never from the server.
 */
export type WritingScorePoint = {
  date: LocalDate;
  promptId: string;
  day: 1 | 7;
  /** 0–100. */
  percent: number;
};

type Essay = { day: 1 | 7; record: EssayDay };

/** Every essay of every week still held: this week's days and history. */
function scoredEssays(progress: WritingProgress): Essay[] {
  return ([1, 7] as const)
    .map((day) => ({ day, record: progress.days[day] }))
    .filter(
      (e): e is Essay =>
        !!e.record?.done && !!e.record.date && essayPercent(e.record) !== null,
    );
}

/** Each scored essay of the current weeks, oldest first. */
export function writingScoreTrend(
  progresses: readonly WritingProgress[],
): WritingScorePoint[] {
  return progresses
    .flatMap((progress) =>
      scoredEssays(progress).map(({ day, record }) => ({
        date: record.date!,
        promptId: progress.promptId,
        day,
        percent: essayPercent(record)!,
      })),
    )
    .sort((a, b) =>
      a.date === b.date ? a.day - b.day : a.date < b.date ? -1 : 1,
    );
}

/**
 * Each criterion's average, as 0–100 of its maximum, over the AI-scored
 * and self-scored essays (the criteria of every rubric by their id).
 */
export function criterionAverages(
  progresses: readonly WritingProgress[],
): { id: CriterionId; percent: number; count: number }[] {
  const sums = new Map<CriterionId, { total: number; count: number }>();
  for (const progress of progresses) {
    for (const { record } of scoredEssays(progress)) {
      const rubric = RUBRICS[record.feedback?.rubric ?? "general"];
      const scores = record.feedback?.criteria ?? record.self?.criteria ?? [];
      for (const score of scores) {
        const criterion = rubric.criteria.find((c) => c.id === score.id);
        if (!criterion) continue;
        const entry = sums.get(score.id) ?? { total: 0, count: 0 };
        entry.total += (score.score / criterion.max) * 100;
        entry.count += 1;
        sums.set(score.id, entry);
      }
    }
  }
  return [...sums.entries()].map(([id, { total, count }]) => ({
    id,
    percent: Math.round(total / count),
    count,
  }));
}

/**
 * The kinds of mistakes found most often: the AI's issues (main and
 * more) and, for self-scored essays, what the learner chose to work on.
 */
export function commonErrors(
  progresses: readonly WritingProgress[],
  top = 5,
): { type: ErrorType; count: number }[] {
  const counts = new Map<ErrorType, number>();
  const add = (type: ErrorType) =>
    counts.set(type, (counts.get(type) ?? 0) + 1);
  for (const progress of progresses) {
    for (const { record } of scoredEssays(progress)) {
      if (record.feedback) {
        for (const issue of [
          ...record.feedback.issues,
          ...record.feedback.more,
        ]) {
          add(issue.type);
        }
      } else {
        record.self?.weak.forEach(add);
      }
    }
  }
  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type))
    .slice(0, top);
}

export type WritingSummary = {
  /** Weeks finished (Day 7 done), passed or not. */
  weeks: number;
  passed: number;
  /** Average Day 7 − Day 1 over finished weeks, 0–100 points; null: none. */
  improvement: number | null;
  /** Patterns reviewed at 1, 3, and 7 days. */
  patterns: number;
};

export function writingSummary(
  progresses: readonly WritingProgress[],
  notebook: Notebook,
): WritingSummary {
  const weeks = progresses.flatMap((p) => p.history);
  // Weeks judged on measures, not scores, have no change in points (D194).
  const scored = weeks.filter((w) => w.basis !== "metrics");
  return {
    weeks: weeks.length,
    passed: weeks.filter((w) => w.passed).length,
    improvement: scored.length
      ? Math.round(
          scored.reduce((sum, w) => sum + (w.day7 - w.day1), 0) / scored.length,
        )
      : null,
    patterns: masteredPatterns(notebook),
  };
}

/** Last week's writing for the weekly report (Monday to Sunday). */
export function writingWeek(
  progresses: readonly WritingProgress[],
  from: LocalDate,
  to: LocalDate,
): { essays: number; drills: number; improvement: number | null } {
  let essays = 0;
  let drills = 0;
  const changes: number[] = [];
  const within = (date?: LocalDate) => !!date && date >= from && date <= to;
  for (const progress of progresses) {
    for (const day of [1, 2, 3, 4, 5, 6, 7] as const) {
      const record = progress.days[day];
      if (!record?.done || !within(record.date)) continue;
      if (day === 1 || day === 7) essays += 1;
      else drills += 1;
    }
    for (const week of progress.history) {
      const day7 =
        progress.week === week.week ? progress.days[7]?.date : undefined;
      if (within(day7) && week.basis !== "metrics") {
        changes.push(week.day7 - week.day1);
      }
    }
  }
  return {
    essays,
    drills,
    improvement: changes.length
      ? Math.round(changes.reduce((a, b) => a + b, 0) / changes.length)
      : null,
  };
}

/** Last week's writing on its own (D214): never added to listening's. */
export type WritingWeeklyReport = {
  from: LocalDate;
  to: LocalDate;
  /** This week's Monday: what a dismissal is remembered by. */
  week: LocalDate;
  /** Writing time counted ("w-" materials), in whole minutes. */
  minutes: number;
  /** Days with writing practice (writingPracticeDays), 0–7. */
  days: number;
  /** Cycle days finished. */
  tasks: number;
  essays: number;
  drills: number;
  improvement: number | null;
};

/**
 * Last week's writing report, or null when it isn't time (reportWeek) or
 * there was no writing last week or the week before. `days` is the
 * writing calendar (writingCalendar).
 */
export function writingWeeklyReport({
  progresses,
  days,
  activity,
  today,
}: {
  progresses: readonly WritingProgress[];
  days: ReadonlyMap<LocalDate, WritingCalendarDay>;
  activity: Activity;
  today: LocalDate;
}): WritingWeeklyReport | null {
  const span = reportWeek(today);
  if (!span) return null;
  const { week, from, to } = span;
  const within = (date: LocalDate, a: LocalDate, b: LocalDate) =>
    date >= a && date <= b;
  const practiced = [...writingPracticeDays(days, activity)];
  const count = practiced.filter((d) => within(d, from, to)).length;
  const before = practiced.filter((d) =>
    within(d, addDays(week, -14), addDays(week, -8)),
  ).length;
  if (count === 0 && before === 0) return null;
  let seconds = 0;
  let tasks = 0;
  for (let i = 0; i < 7; i++) {
    const date = addDays(from, i);
    seconds += daySeconds(activity.days[date], isWritingTimeId);
    tasks += days.get(date)?.tasks.length ?? 0;
  }
  return {
    from,
    to,
    week,
    minutes: Math.round(seconds / 60),
    days: count,
    tasks,
    ...writingWeek(progresses, from, to),
  };
}

/** Writing minutes per day for the last `count` days (D214). */
export function writingDailyMinutes(
  activity: Activity,
  today: LocalDate,
  count: number,
): { date: LocalDate; minutes: number }[] {
  return lastDays(today, count).map((date) => ({
    date,
    minutes: practiceMinutes(activity.days[date], isWritingTimeId),
  }));
}
