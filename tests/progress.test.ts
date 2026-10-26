import { describe, expect, it } from "vitest";
import { createProgress, parseProgress, withDay } from "@/lib/progress";

const today = "2026-10-24";

describe("createProgress", () => {
  it("starts week 1 with no days done", () => {
    expect(createProgress("voa-001", today)).toEqual({
      videoId: "voa-001",
      week: 1,
      startedAt: today,
      days: {},
      status: "in-progress",
      history: [],
    });
  });
});

describe("withDay", () => {
  it("replaces one day without mutating the original", () => {
    const original = createProgress("voa-001", today);
    const updated = withDay(original, 1, {
      done: true,
      date: today,
      score: 0.7,
    });
    expect(updated.days[1]).toEqual({ done: true, date: today, score: 0.7 });
    expect(original.days).toEqual({});
  });
});

describe("parseProgress", () => {
  const valid = {
    ...createProgress("voa-001", today),
    days: {
      "1": { done: true, date: today, score: 0.72, answers: ["hi", null] },
      "2": {
        done: false,
        sentences: [
          { done: true, coverage: 0.9 },
          { done: true, coverage: null },
          { done: false, coverage: 0.4 },
        ],
      },
    },
    history: [
      {
        week: 1,
        startedAt: "2026-10-01",
        day1Score: 0.6,
        day7Score: 0.75,
        passed: false,
      },
    ],
    week: 2,
  };

  it("accepts well-formed progress, including the M2 extensions", () => {
    expect(parseProgress(valid)).toEqual(valid);
  });

  it.each([
    ["not an object", "hello"],
    ["missing videoId", { ...valid, videoId: "" }],
    ["week 0", { ...valid, week: 0 }],
    ["bad date", { ...valid, startedAt: "yesterday" }],
    ["unknown status", { ...valid, status: "done" }],
    ["day 8", { ...valid, days: { "8": { done: true } } }],
    ["score above 1", { ...valid, days: { "1": { done: true, score: 1.5 } } }],
    [
      "non-string answer",
      { ...valid, days: { "1": { done: false, answers: [1] } } },
    ],
    [
      "bad shadowing coverage",
      {
        ...valid,
        days: {
          "2": { done: false, sentences: [{ done: true, coverage: 2 }] },
        },
      },
    ],
    ["history not a list", { ...valid, history: {} }],
    ["bad history entry", { ...valid, history: [{ week: 1 }] }],
  ])("rejects %s", (_, data) => {
    expect(parseProgress(data)).toBeNull();
  });
});
