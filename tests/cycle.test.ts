import { describe, expect, it } from "vitest";
import {
  PASS_THRESHOLD,
  isPassingScore,
  taskForDay,
  type CycleDay,
} from "@/lib/cycle";

describe("isPassingScore", () => {
  it("passes at exactly the threshold", () => {
    expect(PASS_THRESHOLD).toBe(0.8);
    expect(isPassingScore(0.8)).toBe(true);
  });

  it.each([
    [1, true],
    [0.86, true],
    [0.79, false],
    [0, false],
  ])("%s → %s", (score, expected) => {
    expect(isPassingScore(score)).toBe(expected);
  });
});

describe("taskForDay", () => {
  it.each<[CycleDay, string]>([
    [1, "dictation"],
    [2, "shadowing"],
    [4, "shadowing"],
    [6, "shadowing"],
    [7, "redictation"],
  ])("day %s → %s", (day, task) => {
    expect(taskForDay(day)).toBe(task);
  });
});
