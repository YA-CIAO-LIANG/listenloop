import { CYCLE_DAYS, type CycleDay, type DayStatus } from "@/lib/cycle";
import { isLaterDay, isLocalDate, type LocalDate } from "@/lib/dates";
import type { BackRun } from "./back-translation";
import type { WritingFeedback } from "./feedback";
import { compareMetrics } from "./metrics";
import type { CriterionScore } from "./rubrics";
import type { ErrorType } from "./types";

/**
 * One prompt's writing week (D187), stored like ListenLoop's progress:
 * locally as ll-writing:v1:<promptId>, and in the account
 * (writing_progress) when signed in.
 *
 * - Day 1 and Day 7: an essay, scored by the AI (signed in) or by the
 *   learner against the rubric (a guest: `self`), never both.
 * - Days 2–6: the day's back-translation (lib/writing/back-translation.ts,
 *   D195); before D195, the day's drills (lib/writing/drills.ts).
 */
export const EXERCISE_KINDS = [
  "fix",
  "pattern",
  "combine",
  "paraphrase",
  "reorder",
  "rebuild",
  "listen",
] as const;
export type ExerciseKind = (typeof EXERCISE_KINDS)[number];

export type SelfScore = {
  /** The learner's own score per criterion (the rubric's ids). */
  criteria: CriterionScore[];
  /** 0–100, like WritingFeedback.percent. */
  percent: number;
  /** What the learner thinks to work on (error types), up to 3. */
  weak: ErrorType[];
};

export type EssayDay = {
  done: boolean;
  date?: LocalDate;
  essay: string;
  /** Seconds the timer ran while writing (not enforced). */
  seconds?: number;
  feedback?: WritingFeedback;
  self?: SelfScore;
};

export type DrillResult = {
  /** "back": the daily back-translation (D195); else an older drill. */
  kind: ExerciseKind | "back";
  done: boolean;
  /** Right on the first try (rule-checked drills), or the learner's own mark. */
  correct?: boolean;
  /** Back-translation: sentences written back right, of `total`. */
  right?: number;
  total?: number;
};

export type DrillDay = {
  done: boolean;
  date?: LocalDate;
  drills: DrillResult[];
  /**
   * The day's back-translation as it goes (D199): its sentences and each
   * answer, saved at once, so leaving and coming back carries on where
   * it was. Absent before D199.
   */
  back?: BackRun;
  /**
   * Extra practice after the day (D199): another set of sentences, its
   * own answers; never changes the day's result. `round` counts the sets
   * started that day.
   */
  extra?: BackRun & { round: number };
};

export type PassRule = { kind: "beat" } | { kind: "target"; percent: number };

export const DEFAULT_PASS_RULE: PassRule = { kind: "beat" };
export const PASS_TARGETS = [60, 70, 80, 90] as const;

export type WritingWeek = {
  week: number;
  startedAt: LocalDate;
  /** 0–100 each; 0 when that day has no score (basis "metrics"). */
  day1: number;
  day7: number;
  passed: boolean;
  /**
   * "metrics": the days had no scores to compare, so the week was judged
   * on words, sentence length, and variety (D194); the analytics' average
   * change leaves these weeks out.
   */
  basis?: "metrics";
};

export type WritingProgress = {
  promptId: string;
  week: number;
  startedAt: LocalDate;
  status: "in-progress" | "passed" | "repeat";
  rule: PassRule;
  days: {
    1?: EssayDay;
    2?: DrillDay;
    3?: DrillDay;
    4?: DrillDay;
    5?: DrillDay;
    6?: DrillDay;
    7?: EssayDay;
  };
  history: WritingWeek[];
  /** ISO time of the last change, for merging devices. */
  updatedAt: string;
};

export const WRITING_KEY_PREFIX = "ll-writing:v1:";
export const writingKey = (promptId: string) =>
  `${WRITING_KEY_PREFIX}${promptId}`;

/** The practice-time id of a prompt (shares the practice calendar, D187). */
export const writingTimeId = (promptId: string) => `w-${promptId}`;

export function newWritingProgress(
  promptId: string,
  today: LocalDate,
  now: Date = new Date(),
): WritingProgress {
  return {
    promptId,
    week: 1,
    startedAt: today,
    status: "in-progress",
    rule: DEFAULT_PASS_RULE,
    days: {},
    history: [],
    updatedAt: now.toISOString(),
  };
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

function parseRule(value: unknown): PassRule {
  if (isObject(value) && value.kind === "target") {
    const percent = Number(value.percent);
    if (Number.isFinite(percent) && percent >= 0 && percent <= 100)
      return { kind: "target", percent };
  }
  return DEFAULT_PASS_RULE;
}

/** Stored progress, or null when it isn't recognizably ours. */
export function parseWritingProgress(value: unknown): WritingProgress | null {
  if (!isObject(value)) return null;
  if (typeof value.promptId !== "string" || !value.promptId) return null;
  if (!isLocalDate(value.startedAt)) return null;
  const status =
    value.status === "passed" || value.status === "repeat"
      ? value.status
      : "in-progress";
  const days = isObject(value.days) ? value.days : {};
  return {
    promptId: value.promptId,
    week:
      Number.isInteger(value.week) && Number(value.week) > 0
        ? Number(value.week)
        : 1,
    startedAt: value.startedAt,
    status,
    rule: parseRule(value.rule),
    days: days as WritingProgress["days"],
    history: Array.isArray(value.history)
      ? (value.history as WritingWeek[])
      : [],
    updatedAt:
      typeof value.updatedAt === "string"
        ? value.updatedAt
        : new Date(0).toISOString(),
  };
}

const dayDone = (progress: WritingProgress | null, day: CycleDay) =>
  Boolean(progress?.days[day]?.done);

export type WritingLock = "previous" | "tomorrow" | "weekClosed";

/**
 * Like ListenLoop's days (lib/cycle.ts): each day needs the one before,
 * done on an earlier calendar day (unless ignoreDates, the test mode).
 */
export function writingLock(
  progress: WritingProgress | null,
  day: CycleDay,
  today: LocalDate,
  { ignoreDates = false }: { ignoreDates?: boolean } = {},
): WritingLock | null {
  if (dayDone(progress, day)) return null;
  if (progress && progress.status !== "in-progress") return "weekClosed";
  if (day === 1) return null;
  const previous = progress?.days[(day - 1) as CycleDay];
  if (!previous?.done || !previous.date) return "previous";
  if (!ignoreDates && !isLaterDay(today, previous.date)) return "tomorrow";
  return null;
}

export function writingStatuses(
  progress: WritingProgress | null,
  today: LocalDate,
  options: { ignoreDates?: boolean } = {},
): DayStatus[] {
  return CYCLE_DAYS.map((day) => {
    if (dayDone(progress, day)) return "done";
    return writingLock(progress, day, today, options) ? "locked" : "today";
  });
}

/** The day's score, 0–100: the AI's, or the learner's own. */
export function essayPercent(day: EssayDay | undefined): number | null {
  if (!day?.done) return null;
  if (day.feedback && !day.feedback.declined) return day.feedback.percent;
  if (day.self) return day.self.percent;
  return null;
}

/** Whether Day 7 meets the week's rule (D187; default: beat Day 1). */
export function passes(
  rule: PassRule,
  day1: number | null,
  day7: number | null,
): boolean {
  if (day7 === null) return false;
  if (rule.kind === "target") return day7 >= rule.percent;
  if (day1 === null) return false;
  // Day 1 at 100: Day 7 must be 100 too (like ListenLoop, D92).
  return day1 >= 100 ? day7 >= 100 : day7 > day1;
}

/**
 * How Day 7 is judged (D194): by score when the rule can be decided on
 * scores (both days scored, or a target and Day 7 scored); otherwise on
 * the rule-based measures (lib/writing/metrics.ts).
 */
export function weekVerdict(progress: WritingProgress): {
  basis: "score" | "metrics";
  day1: number | null;
  day7: number | null;
  passed: boolean;
} {
  const day1 = essayPercent(progress.days[1]);
  const day7 = essayPercent(progress.days[7]);
  const scored =
    day7 !== null && (day1 !== null || progress.rule.kind === "target");
  if (scored) {
    return {
      basis: "score",
      day1,
      day7,
      passed: passes(progress.rule, day1, day7),
    };
  }
  return {
    basis: "metrics",
    day1,
    day7,
    passed: compareMetrics(
      progress.days[1]?.essay ?? "",
      progress.days[7]?.essay ?? "",
    ).passed,
  };
}

/** Closes the week once Day 7 is done: passed, or the prompt again. */
export function settleWritingWeek(progress: WritingProgress): WritingProgress {
  if (progress.status !== "in-progress" || !progress.days[7]?.done)
    return progress;
  const verdict = weekVerdict(progress);
  return {
    ...progress,
    status: verdict.passed ? "passed" : "repeat",
    history: [
      ...progress.history.filter((w) => w.week !== progress.week),
      {
        week: progress.week,
        startedAt: progress.startedAt,
        day1: verdict.day1 ?? 0,
        day7: verdict.day7 ?? 0,
        passed: verdict.passed,
        ...(verdict.basis === "metrics" ? { basis: "metrics" as const } : {}),
      },
    ],
  };
}

/**
 * The week judged again after a day's score changed (an AI review asked
 * for later, D194): only while this week's days are still here.
 */
export function resettleWritingWeek(
  progress: WritingProgress,
): WritingProgress {
  if (!progress.days[7]?.done) return progress;
  return settleWritingWeek({ ...progress, status: "in-progress" });
}

/** Another week on the same prompt (after it was passed or not). */
export function startWritingWeek(
  progress: WritingProgress,
  today: LocalDate,
  now: Date = new Date(),
): WritingProgress {
  return {
    ...progress,
    week: progress.week + 1,
    startedAt: today,
    status: "in-progress",
    days: {},
    updatedAt: now.toISOString(),
  };
}

/**
 * Two copies of one prompt's progress (this device and the account): the
 * later week wins; in the same week, each day keeps whichever copy has it
 * done, and the copy changed last for everything else.
 */
export function mergeWritingProgress(
  a: WritingProgress,
  b: WritingProgress,
): WritingProgress {
  if (a.week !== b.week) return a.week > b.week ? a : b;
  const [newer, older] = a.updatedAt >= b.updatedAt ? [a, b] : [b, a];
  const days: WritingProgress["days"] = { ...newer.days };
  for (const day of CYCLE_DAYS) {
    const mine = newer.days[day];
    const theirs = older.days[day];
    if (!mine?.done && theirs?.done) {
      (days as Record<number, unknown>)[day] = theirs;
    }
  }
  const history = [...newer.history];
  for (const week of older.history) {
    if (!history.some((w) => w.week === week.week)) history.push(week);
  }
  history.sort((x, y) => x.week - y.week);
  return settleWritingWeek({ ...newer, days, history });
}
