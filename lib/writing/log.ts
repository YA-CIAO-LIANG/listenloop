import { isLocalDate, toLocalDate, type LocalDate } from "@/lib/dates";
import { runSummary, type BackRun } from "./back-translation";
import type { ChatRecord } from "./chat/history";
import {
  essayPercent,
  type DrillDay,
  type EssayDay,
  type WritingProgress,
} from "./progress";

/**
 * The writing calendar's log (D201): what was done on which day, kept so
 * it outlives a week started again (which clears the days) and the chat
 * history's last 20. Stored like the rest of the learner's writing: this
 * browser (ll-writing-log:v1) and the account (`writing-log`); two
 * copies are merged entry by entry.
 *
 * - task: a day of a prompt's cycle done (Day 1 and 7: an essay; days
 *   2–6: back-translation), with its score;
 * - extra: a set of extra practice ended (D199), with its accuracy;
 * - chat: a chat practice.
 */
export type WritingLogEntry = {
  /** Stable, so the same thing is never logged twice. */
  id: string;
  kind: "task" | "extra" | "chat";
  date: LocalDate;
  promptId?: string;
  week?: number;
  day?: number;
  /** 0–100: the essay's score, or the sentences' mean accuracy. */
  percent?: number;
  /** ISO time it was logged. */
  at: string;
};

export type WritingLog = { entries: Record<string, WritingLogEntry> };

export const LOG_KEY = "ll-writing-log:v1";
export const emptyLog = (): WritingLog => ({ entries: {} });

const KINDS = new Set(["task", "extra", "chat"]);

export function parseWritingLog(value: unknown): WritingLog {
  const raw = (value as { entries?: unknown } | null)?.entries;
  if (!raw || typeof raw !== "object") return emptyLog();
  const entries: Record<string, WritingLogEntry> = {};
  for (const [id, e] of Object.entries(raw as Record<string, unknown>)) {
    if (!e || typeof e !== "object") continue;
    const o = e as Record<string, unknown>;
    if (!KINDS.has(o.kind as string) || !isLocalDate(o.date)) continue;
    entries[id] = {
      id,
      kind: o.kind as WritingLogEntry["kind"],
      date: o.date,
      ...(typeof o.promptId === "string" ? { promptId: o.promptId } : {}),
      ...(Number.isInteger(o.week) ? { week: o.week as number } : {}),
      ...(Number.isInteger(o.day) ? { day: o.day as number } : {}),
      ...(typeof o.percent === "number" && o.percent >= 0 && o.percent <= 100
        ? { percent: o.percent }
        : {}),
      at: typeof o.at === "string" ? o.at : new Date(0).toISOString(),
    };
  }
  return { entries };
}

/** Two copies: every entry of both, the later one where both have it. */
export function mergeWritingLogs(a: WritingLog, b: WritingLog): WritingLog {
  const entries = { ...a.entries };
  for (const [id, entry] of Object.entries(b.entries)) {
    const mine = entries[id];
    if (!mine || entry.at > mine.at) entries[id] = entry;
  }
  return { entries };
}

const taskId = (promptId: string, week: number, day: number) =>
  `t:${promptId}:${week}:${day}`;
const extraId = (promptId: string, week: number, day: number, round: number) =>
  `x:${promptId}:${week}:${day}:${round}`;

/** A day's score: an essay's percent, or the back-translation's accuracy. */
function dayPercent(day: number, record: EssayDay | DrillDay): number | null {
  if (day === 1 || day === 7) return essayPercent(record as EssayDay);
  const back = (record as DrillDay).back;
  return back ? runSummary(back).percent : null;
}

/** Every done day of a prompt's current week, as log entries. */
export function progressEntries(
  progress: WritingProgress,
  now: Date = new Date(),
): WritingLogEntry[] {
  const out: WritingLogEntry[] = [];
  for (const day of [1, 2, 3, 4, 5, 6, 7] as const) {
    const record = progress.days[day];
    if (!record?.done || !record.date) continue;
    const percent = dayPercent(day, record);
    out.push({
      id: taskId(progress.promptId, progress.week, day),
      kind: "task",
      date: record.date,
      promptId: progress.promptId,
      week: progress.week,
      day,
      ...(percent !== null ? { percent } : {}),
      at: now.toISOString(),
    });
  }
  return out;
}

/** An ended set of extra practice (D199), logged on the day it ended. */
export function extraEntry(
  progress: Pick<WritingProgress, "promptId" | "week">,
  day: number,
  extra: BackRun & { round: number },
  date: LocalDate,
  now: Date = new Date(),
): WritingLogEntry {
  return {
    id: extraId(progress.promptId, progress.week, day, extra.round),
    kind: "extra",
    date,
    promptId: progress.promptId,
    week: progress.week,
    day,
    percent: runSummary(extra).percent,
    at: now.toISOString(),
  };
}

/** A chat, on the day it started (the learner's time zone). */
export function chatEntry(chat: ChatRecord): WritingLogEntry {
  return {
    id: `c:${chat.id}`,
    kind: "chat",
    date: toLocalDate(new Date(chat.startedAt)),
    at: chat.updatedAt,
  };
}

/**
 * The log with what a progress change finished (D201): days newly done,
 * extra sets newly ended (on `today`). Entries already there are kept,
 * so a day's first completion date stays.
 */
export function logProgressChange(
  log: WritingLog,
  before: WritingProgress | null,
  after: WritingProgress,
  today: LocalDate,
  now: Date = new Date(),
): WritingLog {
  const add: WritingLogEntry[] = progressEntries(after, now).filter(
    (e) => !log.entries[e.id],
  );
  for (const day of [2, 3, 4, 5, 6] as const) {
    const extra = after.days[day]?.extra;
    if (!extra?.done) continue;
    const old = before?.days[day]?.extra;
    const id = extraId(after.promptId, after.week, day, extra.round);
    const entry = extraEntry(after, day, extra, today, now);
    // Newly ended, or judged again by the AI (D200): its latest result,
    // still on the day it ended.
    if (!log.entries[id]) add.push(entry);
    else if (
      old?.round === extra.round &&
      JSON.stringify(old) !== JSON.stringify(extra)
    ) {
      add.push({ ...entry, date: log.entries[id].date });
    }
  }
  if (add.length === 0) return log;
  return {
    entries: {
      ...log.entries,
      ...Object.fromEntries(add.map((e) => [e.id, e])),
    },
  };
}

/** One day on the writing calendar. */
export type WritingCalendarDay = {
  tasks: WritingLogEntry[];
  extras: WritingLogEntry[];
  chats: number;
  /** Day 1 or 7 done: an essay written. */
  essay: boolean;
  /** Mean accuracy of the day's back-translation and extra sets. */
  accuracy: number | null;
};

/**
 * The calendar's days (D201): the log, with the current weeks' days and
 * the chats still kept added (so what was done before the log existed
 * shows too), each thing once.
 */
export function writingCalendar(
  log: WritingLog,
  progresses: readonly WritingProgress[],
  chats: readonly ChatRecord[],
): Map<LocalDate, WritingCalendarDay> {
  const all = new Map<string, WritingLogEntry>();
  for (const p of progresses) {
    for (const e of progressEntries(p, new Date(0))) all.set(e.id, e);
  }
  for (const c of chats) {
    const e = chatEntry(c);
    all.set(e.id, e);
  }
  // The log wins: it holds the date each thing was first done.
  for (const e of Object.values(log.entries)) all.set(e.id, e);

  const days = new Map<LocalDate, WritingCalendarDay>();
  for (const e of all.values()) {
    const day = days.get(e.date) ?? {
      tasks: [],
      extras: [],
      chats: 0,
      essay: false,
      accuracy: null,
    };
    if (e.kind === "task") {
      day.tasks.push(e);
      if (e.day === 1 || e.day === 7) day.essay = true;
    } else if (e.kind === "extra") {
      day.extras.push(e);
    } else {
      day.chats += 1;
    }
    days.set(e.date, day);
  }
  for (const day of days.values()) {
    day.tasks.sort(
      (a, b) =>
        (a.promptId ?? "").localeCompare(b.promptId ?? "") ||
        (a.day ?? 0) - (b.day ?? 0),
    );
    const scored = [
      ...day.tasks.filter((t) => t.day !== 1 && t.day !== 7),
      ...day.extras,
    ]
      .map((e) => e.percent)
      .filter((p): p is number => typeof p === "number");
    day.accuracy = scored.length
      ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length)
      : null;
  }
  return days;
}

/** Chat practice's practice-time material (D201): "w-chat". */
export const CHAT_TIME_ID = "chat";

/** The practice-time ids of writing (D187): "w-<promptId>", "w-chat". */
export const isWritingTimeId = (id: string) => id.startsWith("w-");
