import type { CycleDay } from "./cycle";
import { isLocalDate, type LocalDate } from "./dates";

/** Shape saved per video (see CLAUDE.md 資料格式 → 進度). */

export type ProgressStatus = "in-progress" | "passed" | "repeat";

export type ShadowingSentenceRecord = {
  done: boolean;
  /** Heard share of words, or null when marked done manually (no speech recognition). */
  coverage: number | null;
};

export type DayRecord = {
  done: boolean;
  /** Local date the day was completed. */
  date?: LocalDate;
  /** Dictation accuracy for Day 1 and Day 7, between 0 and 1. */
  score?: number;
  /** Dictation answers per sentence; null = not answered yet. */
  answers?: (string | null)[];
  /** Shadowing state per sentence for Days 2–6. */
  sentences?: ShadowingSentenceRecord[];
};

export type DayKey = `${CycleDay}`;

export type WeekSummary = {
  week: number;
  startedAt: LocalDate;
  day1Score: number;
  day7Score: number;
  passed: boolean;
};

export type Progress = {
  videoId: string;
  /** 1 for the first week; increases each time the video is repeated. */
  week: number;
  startedAt: LocalDate;
  days: Partial<Record<DayKey, DayRecord>>;
  status: ProgressStatus;
  /** Finished weeks, oldest first. */
  history: WeekSummary[];
  /**
   * The version of a created practice this week uses (D44), set when the
   * week's first day starts; a new week takes the latest. Missing on
   * built-in videos, and on weeks begun before versions existed, which
   * all used version 1.
   */
  materialVersion?: number;
};

export function createProgress(videoId: string, today: LocalDate): Progress {
  return {
    videoId,
    week: 1,
    startedAt: today,
    days: {},
    status: "in-progress",
    history: [],
  };
}

/** Returns a copy with one day's record replaced. */
export function withDay(
  progress: Progress,
  day: CycleDay,
  record: DayRecord,
): Progress {
  return { ...progress, days: { ...progress.days, [day]: record } };
}

type Data = Record<string, unknown>;
const isObject = (value: unknown): value is Data =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isRatio = (value: unknown): value is number =>
  typeof value === "number" && value >= 0 && value <= 1;
const isPositiveInteger = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 1;

function isDayRecord(value: unknown): value is DayRecord {
  if (!isObject(value) || typeof value.done !== "boolean") return false;
  if (value.date !== undefined && !isLocalDate(value.date)) return false;
  if (value.score !== undefined && !isRatio(value.score)) return false;
  if (
    value.answers !== undefined &&
    !(
      Array.isArray(value.answers) &&
      value.answers.every((a) => a === null || typeof a === "string")
    )
  ) {
    return false;
  }
  if (
    value.sentences !== undefined &&
    !(
      Array.isArray(value.sentences) &&
      value.sentences.every(
        (s) =>
          isObject(s) &&
          typeof s.done === "boolean" &&
          (s.coverage === null || isRatio(s.coverage)),
      )
    )
  ) {
    return false;
  }
  return true;
}

function isWeekSummary(value: unknown): value is WeekSummary {
  return (
    isObject(value) &&
    isPositiveInteger(value.week) &&
    isLocalDate(value.startedAt) &&
    isRatio(value.day1Score) &&
    isRatio(value.day7Score) &&
    typeof value.passed === "boolean"
  );
}

/**
 * Validates data read from storage. Anything malformed (hand-edited, from an
 * older version, or corrupted) returns null and is treated as no progress.
 */
export function parseProgress(data: unknown): Progress | null {
  if (!isObject(data)) return null;
  const { videoId, week, startedAt, days, status, history } = data;
  if (typeof videoId !== "string" || videoId === "") return null;
  if (!isPositiveInteger(week) || !isLocalDate(startedAt)) return null;
  if (!["in-progress", "passed", "repeat"].includes(status as string)) {
    return null;
  }
  if (!isObject(days)) return null;
  for (const [key, record] of Object.entries(days)) {
    if (!/^[1-7]$/.test(key) || !isDayRecord(record)) return null;
  }
  if (!Array.isArray(history) || !history.every(isWeekSummary)) return null;
  if (
    data.materialVersion !== undefined &&
    !isPositiveInteger(data.materialVersion)
  ) {
    return null;
  }
  return data as Progress;
}

/**
 * The practice version this week uses (D44), or undefined when it isn't
 * fixed yet (no week, or a week with nothing done) or the material has no
 * versions. A week begun before versions existed used version 1.
 */
export function pinnedVersion(progress: Progress | null): number | undefined {
  if (!progress) return undefined;
  if (progress.materialVersion !== undefined) return progress.materialVersion;
  return Object.keys(progress.days).length > 0 ? 1 : undefined;
}

/**
 * Fixes the week to `version` when it starts: only a week with nothing
 * done yet and no version set. Anything else is returned as is.
 */
export function pinVersion(
  progress: Progress,
  version: number | undefined,
): Progress {
  if (
    version === undefined ||
    progress.materialVersion !== undefined ||
    Object.keys(progress.days).length > 0
  ) {
    return progress;
  }
  return { ...progress, materialVersion: version };
}
