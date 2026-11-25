import { topMissedWords, type MaterialInfo } from "./analytics";
import { lastDoneDay, officialScore } from "./cycle";
import type { ClassAllowanceTier } from "./payments/costs";
import { yearlyFromMonthly, type BillingPeriod } from "./payments/pricing";
import { lineHasListening, lineHasWriting, type PlanLine } from "./plans";
import { parseProgress, type Progress } from "./progress";

/**
 * Classroom (D103): class plans, invite codes, and the teacher's view of
 * their students. Numbers and prices live here only.
 */

/**
 * Class plans (D173, D210, Joe 2026-11-24): three sizes, each sold as
 * listening, writing, or both ("all"), billed monthly or yearly (10 ×
 * monthly, like every plan in lib/payments/pricing.ts). `seats` is the
 * most students a class may hold. Listening gives the teacher `words` of
 * their own practices a month; writing gives each student `perStudent`
 * AI a week (a teacher's assignment uses the student's). "all" is both,
 * not discounted. Within COST_CAPS.class of the yearly price at full use
 * (lib/payments/costs.ts, tests/plan-costs.test.ts).
 */
export const CLASS_TIER_IDS = ["small", "standard", "large"] as const;
export type ClassTierId = (typeof CLASS_TIER_IDS)[number];

export type ClassTier = ClassAllowanceTier;

export const CLASS_TIERS: readonly ClassTier[] = [
  {
    id: "small",
    seats: 15,
    monthly: { listening: 349, writing: 299, all: 599 },
    words: 6_750,
    perStudent: {
      essaysPerWeek: 2,
      backChecksPerWeek: 7,
      chatMessagesPerWeek: 15,
    },
  },
  {
    id: "standard",
    seats: 40,
    monthly: { listening: 549, writing: 449, all: 899 },
    words: 10_500,
    perStudent: {
      essaysPerWeek: 2,
      backChecksPerWeek: 5,
      chatMessagesPerWeek: 0,
    },
  },
  {
    id: "large",
    seats: 100,
    monthly: { listening: 800, writing: 690, all: 1_390 },
    words: 15_750,
    perStudent: {
      essaysPerWeek: 2,
      backChecksPerWeek: 3,
      chatMessagesPerWeek: 0,
    },
  },
];

/**
 * Seat counts an account may hold: the three tiers, and earlier grants
 * (10, 20, 80 from D103) that keep working.
 */
export const CLASS_SEAT_OPTIONS = [10, 15, 20, 40, 80, 100] as const;
export type ClassSeats = (typeof CLASS_SEAT_OPTIONS)[number];

export const isClassSeats = (value: unknown): value is ClassSeats =>
  (CLASS_SEAT_OPTIONS as readonly unknown[]).includes(value);

/** The tier a class of `seats` falls in: the smallest that holds it. */
export function classTierFor(seats: number): ClassTier {
  return (
    CLASS_TIERS.find((tier) => seats <= tier.seats) ??
    CLASS_TIERS[CLASS_TIERS.length - 1]
  );
}

/** A tier's price for a line and period (D210). */
export function classPrice(
  tier: ClassTier,
  period: BillingPeriod,
  line: PlanLine = "all",
): number {
  const monthly = tier.monthly[line];
  return period === "year" ? yearlyFromMonthly(monthly) : monthly;
}

/**
 * A teacher's monthly words of their own practices (D103, D173, D209):
 * the class plan's, when its line has listening.
 */
export function classWords(
  seats: ClassSeats | null,
  line: PlanLine = "all",
): number | null {
  return seats === null || !lineHasListening(line)
    ? null
    : classTierFor(seats).words;
}

/**
 * What a class plan gives each of its students a week for writing (D210):
 * null when its line has no writing.
 */
export function classStudentWriting(
  seats: ClassSeats | null,
  line: PlanLine,
): ClassTier["perStudent"] | null {
  return seats === null || !lineHasWriting(line)
    ? null
    : classTierFor(seats).perStudent;
}

/** Invite codes: 8 letters and digits, no 0/O or 1/I to misread. */
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newInviteCode(random: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += CODE_CHARS[Math.floor(random() * CODE_CHARS.length)];
  }
  return code;
}

export const isInviteCode = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Z2-9]{8}$/.test(value.toUpperCase());

export const CLASS_NAME_MAX = 80;
export const DISPLAY_NAME_MAX = 40;
export const ANNOUNCEMENT_MAX = 500;

export type ClassMember = { userId: string; displayName: string };
export type Assignment = {
  id: string;
  videoId: string;
  title: string;
  startsOn: string;
  dueOn: string;
};

/** One student's state on one assignment. */
export type StudentProgress = {
  userId: string;
  displayName: string;
  /** Days finished this week (0–7). */
  daysDone: number;
  /** The day to do next, or null when the week is over. */
  nextDay: number | null;
  day1: number | null;
  day7: number | null;
  /** Day 7 minus Day 1, in points; null until both. */
  improvement: number | null;
  /** The week is finished (passed or to repeat). */
  finished: boolean;
  passed: boolean;
  /** Each finished day's score or coverage... per day, null if none. */
  dayScores: (number | null)[];
  started: boolean;
};

export type AssignmentReport = {
  assignment: Assignment;
  students: StudentProgress[];
  /** Students who haven't finished the week. */
  unfinished: string[];
  missedWords: { word: string; count: number }[];
};

function studentProgress(
  member: ClassMember,
  progress: Progress | null,
): StudentProgress {
  const days = progress?.days ?? {};
  const score = (day: 1 | 7) => {
    const record = days[day];
    return record?.done ? (officialScore(record) ?? null) : null;
  };
  const done = progress ? (lastDoneDay(progress) ?? 0) : 0;
  const day1 = score(1);
  const day7 = score(7);
  const finished =
    progress?.status === "passed" || progress?.status === "repeat";
  const dayScores = [1, 2, 3, 4, 5, 6, 7].map((day) => {
    const record = days[day as 1];
    if (!record?.done) return null;
    if (day === 1 || day === 7) return officialScore(record) ?? null;
    const measured = (record.sentences ?? [])
      .map((s) => s.coverage)
      .filter((c): c is number => c !== null);
    return measured.length
      ? measured.reduce((a, b) => a + b, 0) / measured.length
      : null;
  });
  return {
    userId: member.userId,
    displayName: member.displayName,
    daysDone: done,
    nextDay: finished ? null : done + 1,
    day1,
    day7,
    improvement:
      day1 !== null && day7 !== null ? Math.round((day7 - day1) * 100) : null,
    finished,
    passed: progress?.status === "passed",
    dayScores,
    started: progress !== null,
  };
}

/**
 * The teacher's report for each assignment (D103): every student's day,
 * scores, Day 1 → Day 7, who hasn't finished, and the words the class
 * misheard most. `rows` are class_progress's rows (only this class's
 * students, only assigned materials).
 */
export function classReport(
  members: readonly ClassMember[],
  assignments: readonly Assignment[],
  rows: readonly { user_id: string; video_id: string; data: unknown }[],
  materials: ReadonlyMap<string, MaterialInfo>,
): AssignmentReport[] {
  const byKey = new Map<string, Progress>();
  for (const row of rows) {
    const progress = parseProgress(row.data);
    if (progress) byKey.set(`${row.user_id}|${row.video_id}`, progress);
  }
  return assignments.map((assignment) => {
    const progresses = members.map(
      (m) => byKey.get(`${m.userId}|${assignment.videoId}`) ?? null,
    );
    const students = members.map((m, i) => studentProgress(m, progresses[i]));
    return {
      assignment,
      students,
      unfinished: students.filter((s) => !s.finished).map((s) => s.displayName),
      missedWords: topMissedWords(
        progresses.filter((p): p is Progress => p !== null),
        materials,
        8,
      ),
    };
  });
}

const csvCell = (value: string | number | null) => {
  const text = value === null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** The report as CSV for a spreadsheet (UTF-8 with BOM for Excel). */
export function reportCsv(
  reports: readonly AssignmentReport[],
  headers: readonly string[],
): string {
  const percent = (n: number | null) =>
    n === null ? null : Math.round(n * 100);
  const lines = [headers.map(csvCell).join(",")];
  for (const { assignment, students } of reports) {
    for (const s of students) {
      lines.push(
        [
          assignment.title,
          assignment.dueOn,
          s.displayName,
          s.daysDone,
          s.finished ? (s.passed ? "passed" : "repeat") : "in progress",
          ...s.dayScores.map(percent),
          s.improvement,
        ]
          .map(csvCell)
          .join(","),
      );
    }
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}
