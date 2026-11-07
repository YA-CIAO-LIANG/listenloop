import { describe, expect, it } from "vitest";
import { attemptWeightedScore } from "@/lib/dictation";
import { parseProgress } from "@/lib/progress";
import {
  pace,
  SPEED_WEIGHTS,
  speedWeight,
  WEIGHTED_CAP,
  weightedAccuracy,
} from "@/lib/speed";

/** Speed and weighted accuracy (D73). */
const day = (correct: number, total: number) => ({ correct, total });

describe("weights", () => {
  it("are 90%, 100%, and 105%", () => {
    expect(SPEED_WEIGHTS).toEqual({ "0.75": 0.9, "1": 1, "1.25": 1.05 });
    expect(speedWeight(0.75)).toBe(0.9);
    expect(speedWeight(1.25)).toBe(1.05);
  });

  it("count unknown or missing speeds as 1×", () => {
    expect(speedWeight(undefined)).toBe(1);
    expect(speedWeight(null)).toBe(1);
    expect(speedWeight(2)).toBe(1);
  });
});

describe("weightedAccuracy", () => {
  it("weights each sentence's correct words by its speed", () => {
    // 10/10 at 0.75× and 8/10 at 1×: (9 + 8) / 20.
    expect(weightedAccuracy([day(10, 10), day(8, 10)], [0.75, 1])).toBe(0.85);
  });

  it("never goes above 100%", () => {
    expect(weightedAccuracy([day(10, 10)], [1.25])).toBe(WEIGHTED_CAP);
    // 9/10 at 1.25× is 94.5%: fast helps, but only up to the cap.
    expect(weightedAccuracy([day(9, 10)], [1.25])).toBeCloseTo(0.945);
  });

  it("equals the raw accuracy without speeds", () => {
    expect(weightedAccuracy([day(3, 4), day(1, 4)], [])).toBe(0.5);
  });

  it("can turn a raw pass into a weighted miss on Day 7", () => {
    // 85% heard slowly is 76.5%, under the 80% mark.
    expect(weightedAccuracy([day(17, 20)], [0.75])).toBeCloseTo(0.765);
  });

  it("is 100% for an empty day, like the raw score", () => {
    expect(weightedAccuracy([], [])).toBe(1);
  });
});

describe("pace", () => {
  it("says slow or fast by the word-weighted average speed", () => {
    expect(pace([day(0, 10)], [0.75])).toBe("slow");
    expect(pace([day(0, 10)], [1.25])).toBe("fast");
    expect(pace([day(0, 10), day(0, 10)], [0.75, 1.25])).toBeNull();
    expect(pace([day(0, 30), day(0, 10)], [0.75, 1.25])).toBe("slow");
    expect(pace([day(0, 10)], [1])).toBeNull();
    expect(pace([], [])).toBeNull();
  });
});

describe("attemptWeightedScore", () => {
  it("scores answers with their speeds", () => {
    const sentences = [{ i: 0, start: 0, end: 1, en: "go home", zh: "" }];
    expect(attemptWeightedScore(sentences, ["go home"], [0.75])).toBe(0.9);
    expect(attemptWeightedScore(sentences, ["go home"])).toBe(1);
  });
});

describe("saved progress", () => {
  const base = {
    videoId: "p-1",
    week: 1,
    startedAt: "2026-11-01",
    status: "in-progress",
    history: [],
  };

  it("keeps speeds and weighted scores", () => {
    const progress = {
      ...base,
      days: {
        "1": {
          done: true,
          score: 0.8,
          weightedScore: 0.72,
          answers: ["a"],
          speeds: [0.75],
        },
      },
    };
    expect(parseProgress(progress)).toEqual(progress);
  });

  it("refuses broken speeds", () => {
    expect(
      parseProgress({
        ...base,
        days: { "1": { done: false, speeds: ["fast"] } },
      }),
    ).toBeNull();
    expect(
      parseProgress({
        ...base,
        days: { "1": { done: true, score: 0.5, weightedScore: 1.2 } },
      }),
    ).toBeNull();
  });
});
