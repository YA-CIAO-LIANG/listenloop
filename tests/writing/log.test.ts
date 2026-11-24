import { describe, expect, it } from "vitest";
import { daySeconds } from "@/lib/practice-time";
import { newRun, type BackRun } from "@/lib/writing/back-translation";
import {
  chatEntry,
  emptyLog,
  isWritingTimeId,
  logProgressChange,
  mergeWritingLogs,
  parseWritingLog,
  writingCalendar,
} from "@/lib/writing/log";
import {
  newWritingProgress,
  type WritingProgress,
} from "@/lib/writing/progress";
import type { ChatRecord } from "@/lib/writing/chat/history";

/** The writing calendar's log (D201). */
const NOW = new Date("2026-11-12T10:00:00+08:00");
const answered = (right: boolean[]): BackRun => {
  const run = newRun(
    right.map((_, i) => ({
      en: `Sentence number ${i} here.`,
      source: "model" as const,
    })),
  );
  return {
    ...run,
    answers: right.map((r) => ({
      mode: "listen-write",
      score: r ? 1 : 0.5,
      right: r,
      answer: "x",
    })),
    done: true,
  };
};

function week(): WritingProgress {
  const p = newWritingProgress("daily-perfect-weekend", "2026-11-11", NOW);
  return {
    ...p,
    days: {
      1: {
        done: true,
        date: "2026-11-11",
        essay: "Hi.",
        self: { criteria: [], percent: 60, weak: [] },
      },
      2: {
        done: true,
        date: "2026-11-12",
        drills: [],
        back: answered([true, false]),
      },
    },
  };
}

describe("logging what was finished", () => {
  it("days newly done, with their date and score", () => {
    const log = logProgressChange(emptyLog(), null, week(), "2026-11-12", NOW);
    expect(Object.keys(log.entries).sort()).toEqual([
      "t:daily-perfect-weekend:1:1",
      "t:daily-perfect-weekend:1:2",
    ]);
    expect(log.entries["t:daily-perfect-weekend:1:1"]).toMatchObject({
      date: "2026-11-11",
      percent: 60,
      day: 1,
    });
    expect(log.entries["t:daily-perfect-weekend:1:2"]).toMatchObject({
      date: "2026-11-12",
      percent: 75,
    });
  });

  it("keeps the first date; nothing new, the same log", () => {
    const log = logProgressChange(emptyLog(), null, week(), "2026-11-12", NOW);
    expect(logProgressChange(log, week(), week(), "2026-11-20", NOW)).toBe(log);
  });

  it("an extra set ended is logged on the day it ended; judged again, updated", () => {
    const before = week();
    const extra = { ...answered([false]), round: 1 };
    const after: WritingProgress = {
      ...before,
      days: { ...before.days, 2: { ...before.days[2]!, extra } },
    };
    const log = logProgressChange(emptyLog(), before, after, "2026-11-14", NOW);
    const id = "x:daily-perfect-weekend:1:2:1";
    expect(log.entries[id]).toMatchObject({
      kind: "extra",
      date: "2026-11-14",
      percent: 50,
    });
    const judged: WritingProgress = {
      ...after,
      days: {
        ...after.days,
        2: { ...after.days[2]!, extra: { ...answered([true]), round: 1 } },
      },
    };
    const again = logProgressChange(log, after, judged, "2026-11-15", NOW);
    expect(again.entries[id]).toMatchObject({
      date: "2026-11-14",
      percent: 100,
    });
  });
});

describe("the calendar's days", () => {
  const chat = {
    id: "c1",
    scenario: "classmate",
    level: "intermediate",
    startedAt: "2026-11-12T12:00:00.000Z",
    messages: [],
    updatedAt: "2026-11-12T12:05:00.000Z",
  } as unknown as ChatRecord;

  it("joins the log, the current weeks, and the chats", () => {
    const days = writingCalendar(emptyLog(), [week()], [chat]);
    expect(days.get("2026-11-11")).toMatchObject({
      essay: true,
      chats: 0,
      accuracy: null,
    });
    const day2 = days.get("2026-11-12")!;
    expect(day2.tasks.map((t) => t.day)).toEqual([2]);
    expect(day2.chats).toBe(1);
    expect(day2.accuracy).toBe(75);
  });

  it("counts sentences answered on a day not finished (usability F4)", () => {
    const p = week();
    const back = answered([true]);
    back.answers = back.answers.map((a) => a && { ...a, date: "2026-11-13" });
    const unfinished = {
      ...p,
      days: { ...p.days, 3: { done: false, drills: [], back } },
    };
    const days = writingCalendar(emptyLog(), [unfinished], []);
    expect(days.get("2026-11-13")).toMatchObject({ sentences: 1, tasks: [] });
    expect(days.get("2026-11-12")?.sentences).toBe(2);
  });

  it("the log keeps days a new week cleared", () => {
    const log = logProgressChange(emptyLog(), null, week(), "2026-11-12", NOW);
    const restarted = { ...week(), week: 2, days: {} };
    const days = writingCalendar(log, [restarted], []);
    expect(days.get("2026-11-11")?.essay).toBe(true);
    expect(days.get("2026-11-12")?.tasks).toHaveLength(1);
  });

  it("a chat counts once, from the log or the history", () => {
    const entry = chatEntry(chat);
    const log = { entries: { [entry.id]: entry } };
    expect(writingCalendar(log, [], [chat]).get(entry.date)?.chats).toBe(1);
  });
});

describe("storing the log", () => {
  it("parses what it wrote and drops the rest", () => {
    const log = logProgressChange(emptyLog(), null, week(), "2026-11-12", NOW);
    expect(parseWritingLog(JSON.parse(JSON.stringify(log)))).toEqual(log);
    expect(
      parseWritingLog({ entries: { a: { kind: "nope", date: "2026-11-12" } } }),
    ).toEqual(emptyLog());
    expect(parseWritingLog(null)).toEqual(emptyLog());
  });

  it("merges two copies entry by entry, the later one winning", () => {
    const a = {
      entries: {
        x: {
          id: "x",
          kind: "chat" as const,
          date: "2026-11-12",
          at: "2026-11-12T01:00:00Z",
        },
      },
    };
    const b = {
      entries: {
        x: { ...a.entries.x, date: "2026-11-13", at: "2026-11-12T02:00:00Z" },
        y: { id: "y", kind: "chat" as const, date: "2026-11-14", at: "1" },
      },
    };
    const merged = mergeWritingLogs(a, b);
    expect(merged.entries.x.date).toBe("2026-11-13");
    expect(Object.keys(merged.entries)).toEqual(["x", "y"]);
  });
});

describe("writing time apart from listening (D201)", () => {
  const day = {
    official: false,
    retries: [],
    time: { d1: { sintel: 120, "w-daily": 60, "w-chat": 30 } },
  };
  it("filters by material", () => {
    expect(daySeconds(day)).toBe(210);
    expect(daySeconds(day, isWritingTimeId)).toBe(90);
    expect(daySeconds(day, (id) => !isWritingTimeId(id))).toBe(120);
  });
});
