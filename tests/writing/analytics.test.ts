import { describe, expect, it } from "vitest";
import {
  commonErrors,
  criterionAverages,
  writingScoreTrend,
  writingSummary,
  writingWeek,
} from "@/lib/writing/analytics";
import { emptyNotebook } from "@/lib/writing/notebook";
import {
  newWritingProgress,
  settleWritingWeek,
  type WritingProgress,
} from "@/lib/writing/progress";

const feedback = (percent: number, types: string[]) => ({
  rubric: "general" as const,
  criteria: [
    { id: "task" as const, score: 4, reason: "r" },
    { id: "organization" as const, score: 3, reason: "r" },
    { id: "vocabulary" as const, score: 3, reason: "r" },
    { id: "grammar" as const, score: 2, reason: "r" },
  ],
  percent,
  issues: types.map((type) => ({ quote: "", type, why: "", suggestion: "" })),
  more: [],
  strengths: [],
  summary: "",
});

function week(): WritingProgress {
  const p = newWritingProgress("p", "2026-11-09");
  return settleWritingWeek({
    ...p,
    days: {
      1: {
        done: true,
        date: "2026-11-09",
        essay: "a",
        feedback: feedback(50, ["verb", "article"]),
      } as never,
      2: { done: true, date: "2026-11-10", drills: [] },
      7: {
        done: true,
        date: "2026-11-15",
        essay: "b",
        feedback: feedback(70, ["verb"]),
      } as never,
    },
  });
}

describe("writing in the stats and the weekly report (D190)", () => {
  it("lists scored essays in order", () => {
    expect(writingScoreTrend([week()]).map((p) => [p.day, p.percent])).toEqual([
      [1, 50],
      [7, 70],
    ]);
  });

  it("averages each criterion out of 100", () => {
    const task = criterionAverages([week()]).find((c) => c.id === "task");
    expect(task).toEqual({ id: "task", percent: 80, count: 2 });
  });

  it("counts the most common mistakes", () => {
    expect(commonErrors([week()])[0]).toEqual({ type: "verb", count: 2 });
  });

  it("sums up weeks, the Day 1 → Day 7 change, and patterns", () => {
    expect(writingSummary([week()], emptyNotebook())).toEqual({
      weeks: 1,
      passed: 1,
      improvement: 20,
      patterns: 0,
    });
  });

  it("gives last week's essays and drills", () => {
    expect(writingWeek([week()], "2026-11-09", "2026-11-15")).toEqual({
      essays: 2,
      drills: 1,
      improvement: 20,
    });
    expect(writingWeek([week()], "2026-11-16", "2026-11-22").essays).toBe(0);
  });
});
