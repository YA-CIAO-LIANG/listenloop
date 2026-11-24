import { describe, expect, it } from "vitest";
import {
  answerRun,
  backNotebookItems,
  checkBack,
  explainRun,
  hintLevel,
  newRun,
  sentenceHint,
  timesSeen,
  type BackItem,
  type BackRun,
} from "@/lib/writing/back-translation";
import {
  bedtimeDue,
  logReview,
  matchRecall,
  todaysSentences,
} from "@/lib/writing/bedtime";
import { emptyLog, writingCalendar } from "@/lib/writing/log";
import {
  addToNotebook,
  dueToday,
  emptyNotebook,
  parseNotebook,
} from "@/lib/writing/notebook";
import {
  day30Of,
  day30State,
  mergeWritingProgress,
  newWritingProgress,
  parseWritingProgress,
  type WritingProgress,
} from "@/lib/writing/progress";
import { parseWritingSettings } from "@/lib/writing/settings";

/** The learning-science helps (D202, D203). */
const ITEMS: BackItem[] = [
  {
    en: "My perfect weekend would start slowly.",
    zh: "我完美的週末會慢慢開始。",
    source: "model",
  },
  {
    en: "We would cook dinner together.",
    zh: "我們會一起煮晚餐。",
    source: "model",
  },
];
const answer = (
  item: BackItem,
  text: string,
  confidence?: "sure" | "maybe" | "unsure",
) => ({
  ...checkBack(item, "listen-write", text),
  answer: text,
  ...(confidence ? { confidence } : {}),
});

describe("confidence and the notebook (D202)", () => {
  it("sure but wrong comes first; right but unsure goes in too", () => {
    let run = newRun(ITEMS);
    run = answerRun(
      run,
      0,
      answer(ITEMS[0], "totally different words", "sure"),
    );
    run = answerRun(run, 1, answer(ITEMS[1], ITEMS[1].en, "unsure"));
    const items = backNotebookItems("p", run);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ answer: ITEMS[0].en, priority: true });
    expect(items[1]).toMatchObject({ answer: ITEMS[1].en });
    expect(items[1]).not.toHaveProperty("priority");
  });

  it("right and sure stays out", () => {
    const run = answerRun(
      newRun(ITEMS),
      0,
      answer(ITEMS[0], ITEMS[0].en, "maybe"),
    );
    expect(backNotebookItems("p", run)).toEqual([]);
  });

  it("priority entries are reviewed first when due", () => {
    let nb = addToNotebook(
      emptyNotebook(),
      [
        {
          id: "a",
          kind: "back",
          promptId: "p",
          text: "",
          answer: "A a a.",
          note: "",
        },
      ],
      "2026-11-01",
    );
    nb = addToNotebook(
      nb,
      [
        {
          id: "z",
          kind: "back",
          promptId: "p",
          text: "",
          answer: "Z z z.",
          note: "",
          priority: true,
        },
      ],
      "2026-11-05",
    );
    expect(dueToday(nb, "2026-11-10").map((e) => e.id)).toEqual(["z", "a"]);
    expect(
      parseNotebook(JSON.parse(JSON.stringify(nb))).entries.z.priority,
    ).toBe(true);
  });
});

describe("fading hints (D202)", () => {
  it("first letters and count, then the count, then nothing", () => {
    expect(hintLevel(0)).toBe(2);
    expect(hintLevel(1)).toBe(1);
    expect(hintLevel(5)).toBe(0);
    expect(sentenceHint("My perfect weekend.", 2)).toEqual({
      words: 3,
      letters: "M_ p___ w___",
    });
    expect(sentenceHint("My perfect weekend.", 1)).toEqual({
      words: 3,
      letters: "",
    });
    expect(sentenceHint("My perfect weekend.", 0)).toBeNull();
  });

  it("counts earlier answers of the same sentence, not the current set", () => {
    const done = answerRun(newRun(ITEMS), 0, answer(ITEMS[0], "x"));
    const extra: BackRun = answerRun(
      newRun([ITEMS[0]]),
      0,
      answer(ITEMS[0], "y"),
    );
    const days = { 2: { back: done, extra }, 3: { back: newRun(ITEMS) } };
    expect(timesSeen(days, "my perfect weekend would start slowly")).toBe(2);
    expect(timesSeen(days, ITEMS[0].en, extra)).toBe(1);
    expect(timesSeen(days, ITEMS[1].en)).toBe(0);
  });
});

describe("self-explanation (D202)", () => {
  it("kept once on the answer, at most 300 characters", () => {
    const run = answerRun(newRun(ITEMS), 0, answer(ITEMS[0], "wrong"));
    const explained = explainRun(run, 0, "動詞時態".repeat(100));
    expect(explained.answers[0]?.explain).toHaveLength(300);
    expect(explainRun(explained, 0, "again")).toBe(explained);
    expect(explainRun(run, 1, "no answer yet")).toBe(run);
  });
});

describe("settings (D202, D203)", () => {
  it("on by default; a bad time falls back to 21:30", () => {
    const s = parseWritingSettings({ bedtimeAt: "25:99" });
    expect(s).toMatchObject({
      confidence: true,
      scaffold: true,
      selfExplain: true,
      bedtime: true,
      bedtimeAt: "21:30",
      day30: true,
    });
    expect(
      parseWritingSettings({ confidence: false, bedtimeAt: "22:15" }),
    ).toMatchObject({ confidence: false, bedtimeAt: "22:15" });
  });
});

function week(): WritingProgress {
  const p = newWritingProgress("p", "2026-11-01");
  const back = answerRun(newRun(ITEMS), 0, answer(ITEMS[0], "x"));
  return {
    ...p,
    days: {
      1: {
        done: true,
        date: "2026-11-01",
        essay: "One.",
        self: { criteria: [], percent: 50, weak: [] },
      },
      2: { done: false, date: "2026-11-02", drills: [], back },
      7: {
        done: true,
        date: "2026-11-07",
        essay: "Seven.",
        self: { criteria: [], percent: 70, weak: [] },
      },
    },
  };
}

describe("the evening review (D203)", () => {
  const evening = new Date(2026, 10, 2, 22, 0);
  const morning = new Date(2026, 10, 2, 9, 0);

  it("today's sentences: answered today, and the notebook's new ones", () => {
    const nb = addToNotebook(
      emptyNotebook(),
      [
        {
          id: "e",
          kind: "error",
          promptId: "p",
          text: "he go",
          answer: "he goes",
          note: "",
        },
      ],
      "2026-11-02",
    );
    expect(todaysSentences([week()], nb, "2026-11-02")).toEqual([
      ITEMS[0].en,
      "he goes",
    ]);
    expect(todaysSentences([week()], emptyNotebook(), "2026-11-03")).toEqual(
      [],
    );
  });

  it("due after the time, with something to recall, not done yet", () => {
    const base = {
      on: true,
      at: "21:30",
      today: "2026-11-02",
      log: emptyLog(),
      sentences: ["A b c."],
    };
    expect(bedtimeDue({ ...base, now: evening })).toBe(true);
    expect(bedtimeDue({ ...base, now: morning })).toBe(false);
    expect(bedtimeDue({ ...base, now: evening, on: false })).toBe(false);
    expect(bedtimeDue({ ...base, now: evening, sentences: [] })).toBe(false);
    const done = logReview(emptyLog(), "2026-11-02", 2);
    expect(bedtimeDue({ ...base, now: evening, log: done })).toBe(false);
    expect(writingCalendar(done, [], []).get("2026-11-02")?.review).toBe(true);
  });

  it("a recalled sentence counts with most of its words", () => {
    const results = matchRecall(
      ["my perfect weekend starts slowly", "", "pizza"],
      ITEMS.map((i) => i.en),
    );
    expect(results).toHaveLength(2);
    expect(results[0].match).toBe(ITEMS[0].en);
    expect(results[1].match).toBeNull();
  });
});

describe("Day 30 (D203)", () => {
  it("opens 29 days after Day 1 of a finished week", () => {
    expect(day30State(week(), "2026-11-20")).toBe("early");
    expect(day30State(week(), "2026-11-30")).toBe("open");
    const unfinished = { ...week(), days: { ...week().days, 7: undefined } };
    expect(day30State(unfinished, "2026-12-30")).toBeNull();
    expect(day30State({ ...week(), day30Skipped: 1 }, "2026-11-30")).toBeNull();
    const written = {
      ...week(),
      day30: {
        done: true,
        date: "2026-11-30" as const,
        essay: "Thirty.",
        week: 1,
      },
    };
    expect(day30State(written, "2026-11-30")).toBe("done");
    // Another week: that week's Day 30 isn't this one's.
    expect(day30Of({ ...written, week: 2 })).toBeUndefined();
  });

  it("is kept when parsed and merged", () => {
    const written = {
      ...week(),
      day30: {
        done: true,
        date: "2026-11-30" as const,
        essay: "Thirty.",
        week: 1,
      },
      updatedAt: "2026-11-30T00:00:00Z",
    };
    expect(
      parseWritingProgress(JSON.parse(JSON.stringify(written)))?.day30?.essay,
    ).toBe("Thirty.");
    const newer = { ...week(), updatedAt: "2026-12-01T00:00:00Z" };
    expect(mergeWritingProgress(newer, written).day30?.essay).toBe("Thirty.");
  });
});
