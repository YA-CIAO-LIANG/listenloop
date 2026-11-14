import { reviewKey } from "./review";
import { quizAccuracy } from "./vocab-quiz";
import type { Activity } from "./activity";
import { missedPieces, missedWords } from "./custom-practice/marks";
import { officialScore } from "./cycle";
import type { LocalDate } from "./dates";
import { tasksByDate } from "./practice-calendar";
import { daySeconds } from "./practice-time";
import { practiceDays, streakStatus, type StreakStatus } from "./streak";
import type { Progress } from "./progress";

/**
 * The learner's stats page (D75), computed from what's already saved:
 * progress, the activity log with its practice time (D74), and the
 * materials' sentences. Pure, so the page and the tests share it.
 */

/** What the stats need to know about each material. */
export type MaterialInfo = {
  title: string;
  /** Library category (lib/categories.ts), or null. */
  category: string | null;
  level: string | null;
  /** English sentences, in order, for the misheard words. */
  sentences: readonly string[];
};

/** Calendar days ending at `today`, oldest first. */
export function lastDays(today: LocalDate, count: number): LocalDate[] {
  const [y, m, d] = today.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const day = new Date(Date.UTC(y, m - 1, d - (count - 1 - i)));
    return day.toISOString().slice(0, 10);
  });
}

/** Practice minutes per day for the last `count` days (bars). */
export function dailyMinutes(
  activity: Activity,
  today: LocalDate,
  count: number,
): { date: LocalDate; minutes: number }[] {
  return lastDays(today, count).map((date) => ({
    date,
    minutes: Math.round(daySeconds(activity.days[date]) / 60),
  }));
}

export type ScorePoint = {
  date: LocalDate;
  videoId: string;
  day: 1 | 7;
  raw: number;
  weighted: number;
};

/**
 * Every scored dictation (Day 1 and Day 7) with its date, oldest first:
 * the current week's from progress, earlier weeks' from history, dated by
 * the activity log (weeks the log doesn't date are left out).
 */
export function accuracyTrend(
  progresses: readonly Progress[],
  activity: Activity,
): ScorePoint[] {
  const dated = new Map<string, LocalDate>();
  for (const [date, tasks] of tasksByDate(activity, progresses)) {
    for (const t of tasks) dated.set(`${t.videoId}:${t.week}:${t.day}`, date);
  }
  const points: ScorePoint[] = [];
  for (const progress of progresses) {
    for (const week of progress.history) {
      for (const day of [1, 7] as const) {
        const date = dated.get(`${progress.videoId}:${week.week}:${day}`);
        if (!date) continue;
        const raw = day === 1 ? week.day1Score : week.day7Score;
        const weighted =
          (day === 1 ? week.day1Weighted : week.day7Weighted) ?? raw;
        points.push({ date, videoId: progress.videoId, day, raw, weighted });
      }
    }
    // The current week, unless it's already in history (a settled week).
    const settled = progress.history.some((w) => w.week === progress.week);
    if (settled) continue;
    for (const day of [1, 7] as const) {
      const record = progress.days[day];
      if (!record?.done || record.score === undefined || !record.date) continue;
      points.push({
        date: record.date,
        videoId: progress.videoId,
        day,
        raw: record.score,
        weighted: officialScore(record) ?? record.score,
      });
    }
  }
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

/** Each material's latest Day 1 and Day 7, weighted (what the week counted). */
export function dayOneVsSeven(
  progresses: readonly Progress[],
): { videoId: string; day1: number; day7: number }[] {
  const out: { videoId: string; day1: number; day7: number }[] = [];
  for (const progress of progresses) {
    const day1 = progress.days[1];
    const day7 = progress.days[7];
    if (day1?.score !== undefined && day7?.score !== undefined) {
      out.push({
        videoId: progress.videoId,
        day1: officialScore(day1) ?? day1.score,
        day7: officialScore(day7) ?? day7.score,
      });
      continue;
    }
    const last = progress.history.at(-1);
    if (last) {
      out.push({
        videoId: progress.videoId,
        day1: last.day1Weighted ?? last.day1Score,
        day7: last.day7Weighted ?? last.day7Score,
      });
    }
  }
  return out;
}

/**
 * The words missed most often in dictation (Day 1 and Day 7 answers kept
 * in progress), lowercased, most first; ties alphabetical.
 */
export function topMissedWords(
  progresses: readonly Progress[],
  materials: ReadonlyMap<string, MaterialInfo>,
  limit = 10,
): { word: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const progress of progresses) {
    const sentences = materials.get(progress.videoId)?.sentences;
    if (!sentences) continue;
    for (const day of [1, 7] as const) {
      const answers = progress.days[day]?.answers ?? [];
      answers.forEach((answer, i) => {
        const en = sentences[i];
        if (typeof answer !== "string" || !en) return;
        for (const word of missedWords(en, missedPieces(en, answer))) {
          const key = word.toLowerCase();
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
      });
    }
  }
  return [...counts]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, limit);
}

/** How many started materials fall in each category, or level. */
export function distribution(
  progresses: readonly Progress[],
  materials: ReadonlyMap<string, MaterialInfo>,
  by: "category" | "level",
): { key: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const progress of progresses) {
    const key = materials.get(progress.videoId)?.[by];
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

/**
 * Days in a row with practice (an official task or counted time), ending
 * today, or yesterday when today has none yet; the longest run; and the
 * weekly streak freeze (D176, lib/streak.ts).
 */
export function streaks(
  activity: Activity,
  progresses: readonly Progress[],
  today: LocalDate,
): StreakStatus {
  return streakStatus(practiceDays(activity, progresses), today);
}

/** Site-wide numbers for the admin dashboard (D75): no one is named. */
export function siteActivity(
  activities: readonly Activity[],
  progresses: readonly Progress[],
  today: LocalDate,
  count = 30,
): {
  days: { date: LocalDate; active: number; minutes: number }[];
  /** Average minutes a day per learner who practiced that day. */
  averageMinutes: number;
  accuracy: { raw: number; weighted: number; n: number } | null;
} {
  const days = lastDays(today, count).map((date) => {
    let active = 0;
    let seconds = 0;
    for (const activity of activities) {
      const day = activity.days[date];
      const s = daySeconds(day);
      if (s > 0 || day?.official) active += 1;
      seconds += s;
    }
    return { date, active, minutes: Math.round(seconds / 60) };
  });
  const learnerDays = days.reduce((sum, d) => sum + d.active, 0);
  const minutes = days.reduce((sum, d) => sum + d.minutes, 0);
  let raw = 0;
  let weighted = 0;
  let n = 0;
  for (const progress of progresses) {
    for (const record of [progress.days[1], progress.days[7]]) {
      if (record?.done && record.score !== undefined) {
        raw += record.score;
        weighted += officialScore(record) ?? record.score;
        n += 1;
      }
    }
  }
  return {
    days,
    averageMinutes: learnerDays === 0 ? 0 : minutes / learnerDays,
    accuracy: n === 0 ? null : { raw: raw / n, weighted: weighted / n, n },
  };
}

/** One vocabulary quiz on the stats trend (D136). */
export type QuizPoint = {
  takenAt: string;
  videoId: string;
  day: 1 | 7;
  accuracy: number;
};

/** Each quiz's accuracy (both steps of every word), oldest first. */
export function quizTrend(
  attempts: readonly {
    takenAt: string;
    videoId: string;
    day: 1 | 7;
    total: number;
    spelled: number;
    translated: number;
  }[],
): QuizPoint[] {
  return [...attempts]
    .sort((a, b) => a.takenAt.localeCompare(b.takenAt))
    .map((a) => ({
      takenAt: a.takenAt,
      videoId: a.videoId,
      day: a.day,
      accuracy: quizAccuracy(a),
    }));
}

/**
 * Words mastered (D136): those whose latest quiz had both steps right
 * with no hint.
 */
export function wordsMastered(
  attempts: readonly {
    takenAt: string;
    words: readonly {
      word: string;
      spelled: boolean;
      translated: boolean;
      hints: number;
    }[];
  }[],
): number {
  const latest = new Map<string, boolean>();
  for (const attempt of [...attempts].sort((a, b) =>
    a.takenAt.localeCompare(b.takenAt),
  )) {
    for (const word of attempt.words) {
      latest.set(
        reviewKey(word.word),
        word.spelled && word.translated && word.hints === 0,
      );
    }
  }
  return [...latest.values()].filter(Boolean).length;
}
