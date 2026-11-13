import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cleanSurvey, npsOf, surveyKey } from "@/lib/survey";

describe("Day 7 survey (D164)", () => {
  it("accepts a whole score from 0 to 10 and trims the comment", () => {
    expect(
      cleanSurvey({ videoId: "sintel", week: 2, score: 10, comment: "  好 " }),
    ).toEqual({ videoId: "sintel", week: 2, score: 10, comment: "好" });
    expect(
      cleanSurvey({ videoId: "p-1a2b", week: 1, score: 0, comment: "   " }),
    ).toEqual({ videoId: "p-1a2b", week: 1, score: 0, comment: null });
  });

  it("refuses anything else", () => {
    for (const bad of [
      null,
      { videoId: "sintel", week: 1, score: 11 },
      { videoId: "sintel", week: 1, score: -1 },
      { videoId: "sintel", week: 1, score: 7.5 },
      { videoId: "sintel", week: 0, score: 7 },
      { videoId: "../x", week: 1, score: 7 },
      { videoId: "sintel", week: 1, score: "7" },
    ]) {
      expect(cleanSurvey(bad)).toBeNull();
    }
    expect(
      cleanSurvey({
        videoId: "a",
        week: 1,
        score: 5,
        comment: "x".repeat(5000),
      })?.comment,
    ).toHaveLength(1000);
  });

  it("computes the Net Promoter Score", () => {
    expect(npsOf([])).toMatchObject({ count: 0, nps: null, average: null });
    // 2 promoters, 1 passive, 1 detractor: (2 - 1) / 4 = 25.
    expect(npsOf([10, 9, 8, 3])).toEqual({
      count: 4,
      promoters: 2,
      passives: 1,
      detractors: 1,
      nps: 25,
      average: 7.5,
    });
    expect(npsOf([0, 6]).nps).toBe(-100);
    expect(npsOf([9]).nps).toBe(100);
  });

  it("keys one answer per material and week", () => {
    expect(surveyKey("sintel", 3)).toBe("sintel:w3");
    const sql = readFileSync(
      "supabase/migrations/20261128000000_week_surveys.sql",
      "utf8",
    );
    expect(sql).toMatch(/unique \(user_id, video_id, week\)/);
    expect(sql).toMatch(/on delete cascade/);
  });
});
