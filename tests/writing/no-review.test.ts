import { describe, expect, it } from "vitest";
import { writingSummary, writingWeek } from "@/lib/writing/analytics";
import { emptyNotebook } from "@/lib/writing/notebook";
import {
  compareMetrics,
  essayMetrics,
  MATTR_WINDOW,
} from "@/lib/writing/metrics";
import {
  newWritingProgress,
  resettleWritingWeek,
  settleWritingWeek,
  weekVerdict,
  type WritingProgress,
} from "@/lib/writing/progress";
import {
  DEFAULT_WRITING_SETTINGS,
  mergeWritingSettings,
  parseWritingSettings,
} from "@/lib/writing/settings";

/** Saving without a review (D194): measures, verdicts, settings. */
const DAY1 = "I go park. It is fun. I like it.";
const DAY7 =
  "On Saturday I went to the park with my brother, and we played basketball until sunset. Afterwards we cooked dinner together because our parents were working late.";

const unscored = (date: string, essay: string) => ({
  done: true,
  date,
  essay,
});

function week(days: WritingProgress["days"], rule?: WritingProgress["rule"]) {
  return {
    ...newWritingProgress("p", "2026-11-01"),
    ...(rule ? { rule } : {}),
    days,
  };
}

describe("essay measures", () => {
  it("counts words, sentences, and their length", () => {
    const m = essayMetrics("I like tea. Do you? Yes, 3 cups a day!");
    expect(m.words).toBe(10);
    expect(m.sentences).toBe(3);
    expect(m.sentenceWords).toBe(3.3);
  });

  it("is 0 for nothing written", () => {
    expect(essayMetrics("")).toEqual({
      words: 0,
      sentences: 0,
      sentenceWords: 0,
      diversity: 0,
    });
  });

  it("measures variety over windows, so length alone doesn't lower it", () => {
    const varied = Array.from(
      { length: 120 },
      (_, i) => `w${"abcdefghij"[i % 10]}${Math.floor(i / 10)}`,
    )
      .join(" ")
      .replace(/\d/g, (d) => "klmnopqrst"[Number(d)]);
    const repeated = Array.from({ length: 120 }, () => "the cat").join(" ");
    expect(essayMetrics(varied).diversity).toBe(100);
    expect(essayMetrics(repeated).diversity).toBeLessThan(10);
    expect(MATTR_WINDOW).toBe(50);
  });

  it("passes when two of the three measures improved", () => {
    const result = compareMetrics(DAY1, DAY7);
    expect(result.rows.map((r) => r.better)).toEqual([true, true, true]);
    expect(result.improved).toBe(3);
    // Longer and longer sentences, but the same few words: two of three.
    const two = compareMetrics(
      "I like it. I like it.",
      "I like it and I like it and I like it.",
    );
    expect(two.improved).toBe(2);
    expect(two.passed).toBe(true);
    expect(result.passed).toBe(true);
    expect(compareMetrics(DAY7, DAY1).passed).toBe(false);
  });

  it("doesn't count sentences longer than 22 words on average as better", () => {
    const long = `${Array.from({ length: 30 }, (_, i) => `word${"abcdefghijklmnopqrstuvwxyzab"[i] ?? "z"}`).join(" ")}.`;
    const longer = `${Array.from({ length: 40 }, (_, i) => `term${"abcdefghijklmnopqrstuvwxyzabcdefghijklmn"[i]}`).join(" ")}.`;
    const row = compareMetrics(long, longer).rows.find(
      (r) => r.id === "sentenceWords",
    )!;
    expect(row.better).toBe(false);
  });
});

describe("the week without scores (D194)", () => {
  it("is judged on the measures when neither day has a score", () => {
    const progress = week({
      1: unscored("2026-11-01", DAY1),
      7: unscored("2026-11-07", DAY7),
    });
    expect(weekVerdict(progress)).toEqual({
      basis: "metrics",
      day1: null,
      day7: null,
      passed: true,
    });
    const settled = settleWritingWeek(progress);
    expect(settled.status).toBe("passed");
    expect(settled.history[0]).toMatchObject({
      basis: "metrics",
      passed: true,
    });
  });

  it("uses scores when both days have one", () => {
    const self = (percent: number) => ({ criteria: [], percent, weak: [] });
    const progress = week({
      1: { ...unscored("2026-11-01", DAY1), self: self(70) },
      7: { ...unscored("2026-11-07", DAY7), self: self(60) },
    });
    expect(weekVerdict(progress).basis).toBe("score");
    expect(settleWritingWeek(progress).status).toBe("repeat");
  });

  it("uses a target score when Day 7 has one, even without Day 1's", () => {
    const progress = week(
      {
        1: unscored("2026-11-01", DAY1),
        7: {
          ...unscored("2026-11-07", DAY1),
          self: { criteria: [], percent: 85, weak: [] },
        },
      },
      { kind: "target", percent: 80 },
    );
    expect(weekVerdict(progress)).toMatchObject({
      basis: "score",
      passed: true,
    });
  });

  it("is judged again when a review comes later", () => {
    const settled = settleWritingWeek(
      week({
        1: {
          ...unscored("2026-11-01", DAY1),
          self: { criteria: [], percent: 50, weak: [] },
        },
        7: unscored("2026-11-07", DAY1),
      }),
    );
    expect(settled.history[0].basis).toBe("metrics");
    const reviewed = resettleWritingWeek({
      ...settled,
      days: {
        ...settled.days,
        7: {
          ...settled.days[7]!,
          self: { criteria: [], percent: 80, weak: [] },
        },
      },
    });
    expect(reviewed.status).toBe("passed");
    expect(reviewed.history).toHaveLength(1);
    expect(reviewed.history[0]).toMatchObject({
      day1: 50,
      day7: 80,
      passed: true,
    });
    expect(reviewed.history[0].basis).toBeUndefined();
  });

  it("leaves weeks judged on measures out of the average change", () => {
    const scored = {
      week: 1,
      startedAt: "2026-11-01",
      day1: 50,
      day7: 70,
      passed: true,
    };
    const measured = {
      week: 2,
      startedAt: "2026-11-08",
      day1: 0,
      day7: 0,
      passed: true,
      basis: "metrics" as const,
    };
    const progress: WritingProgress = {
      ...newWritingProgress("p", "2026-11-08"),
      week: 2,
      days: { 7: unscored("2026-11-14", DAY7) },
      history: [scored, measured],
    };
    expect(writingSummary([progress], emptyNotebook()).improvement).toBe(20);
    expect(
      writingWeek([progress], "2026-11-09", "2026-11-15").improvement,
    ).toBeNull();
  });
});

describe("writing settings", () => {
  it("defaults to AI review and listening dictation", () => {
    expect(parseWritingSettings(null)).toEqual(DEFAULT_WRITING_SETTINGS);
    expect(
      parseWritingSettings({ review: "none", dictation: "bogus" }),
    ).toMatchObject({
      review: "none",
      dictation: "listen-write",
    });
  });

  it("keeps the copy changed last", () => {
    const a = {
      ...DEFAULT_WRITING_SETTINGS,
      review: "none" as const,
      at: "2026-11-21T01:00:00Z",
    };
    const b = { ...DEFAULT_WRITING_SETTINGS, at: "2026-11-21T02:00:00Z" };
    expect(mergeWritingSettings(a, b)).toBe(b);
    expect(mergeWritingSettings(b, a)).toBe(b);
  });
});
