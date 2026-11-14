import { describe, expect, it } from "vitest";
import {
  CLASS_COST,
  classCostPerMinute,
  classMinutes,
  classMinutesCost,
  classPrice,
  CLASS_TIERS,
  classTierFor,
  classReport,
  isInviteCode,
  newInviteCode,
  reportCsv,
} from "@/lib/classroom";
import { createProgress, withDay, type Progress } from "@/lib/progress";

describe("class plans (D103, D173)", () => {
  it("are three tiers by class size: NT$349, NT$549, NT$800 a month", () => {
    expect(
      CLASS_TIERS.map(({ id, seats, monthly }) => [id, seats, monthly]),
    ).toEqual([
      ["small", 15, 349],
      ["standard", 40, 549],
      ["large", 100, 800],
    ]);
    expect(CLASS_TIERS.map((tier) => classPrice(tier, "year"))).toEqual([
      3490, 5490, 8000,
    ]);
  });

  it("give the teacher minutes whose full use costs at most 25% of the price", () => {
    // US$0.0218 language + 1,209 characters at US$30/M voice, × NT$32.
    expect(classCostPerMinute()).toBeCloseTo(1.858, 3);
    for (const tier of CLASS_TIERS) {
      expect(classMinutesCost(tier)).toBeLessThanOrEqual(
        tier.monthly * CLASS_COST.maxShare,
      );
      // ...and not far below it: the next 5 minutes would go over.
      expect((tier.minutes + 5) * classCostPerMinute()).toBeGreaterThan(
        tier.monthly * CLASS_COST.maxShare,
      );
    }
    expect(CLASS_TIERS.map((tier) => tier.minutes)).toEqual([45, 70, 105]);
  });

  it("put every seat count in the smallest tier that holds it", () => {
    expect(classTierFor(10).id).toBe("small");
    expect(classTierFor(15).id).toBe("small");
    expect(classTierFor(20).id).toBe("standard");
    expect(classTierFor(40).id).toBe("standard");
    expect(classTierFor(80).id).toBe("large");
    expect(classTierFor(100).id).toBe("large");
    expect(classMinutes(15)).toBe(45);
    // An earlier grant keeps working, with its tier's minutes.
    expect(classMinutes(20)).toBe(70);
    expect(classMinutes(null)).toBeNull();
  });

  it("makes readable invite codes", () => {
    const code = newInviteCode();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect(isInviteCode(code.toLowerCase())).toBe(true);
    expect(isInviteCode("ABC")).toBe(false);
    expect(isInviteCode("ABCDEFG0")).toBe(false);
  });
});

describe("the teacher's report (D103)", () => {
  const members = [
    { userId: "u1", displayName: "01 王小明" },
    { userId: "u2", displayName: "02 林小華" },
    { userId: "u3", displayName: "03 陳小美" },
  ];
  const assignments = [
    {
      id: "a1",
      videoId: "sintel",
      title: "Sintel",
      startsOn: "2026-11-02",
      dueOn: "2026-11-09",
    },
  ];
  let week: Progress = createProgress("sintel", "2026-11-02");
  week = withDay(week, 1, {
    done: true,
    date: "2026-11-02",
    score: 0.5,
    answers: ["go home", "we move"],
  });
  for (const day of [2, 3, 4, 5, 6] as const) {
    week = withDay(week, day, {
      done: true,
      date: `2026-11-0${day + 1}`,
      sentences: [{ done: true, coverage: 0.8 }],
    });
  }
  const finished: Progress = {
    ...withDay(week, 7, {
      done: true,
      date: "2026-11-09",
      score: 0.75,
      answers: ["go home", "we moved"],
    }),
    status: "passed",
  };
  const rows = [
    { user_id: "u1", video_id: "sintel", data: finished },
    { user_id: "u2", video_id: "sintel", data: week },
  ];
  const materials = new Map([
    [
      "sintel",
      {
        title: "Sintel",
        category: null,
        level: null,
        sentences: ["Go home.", "We moved."],
      },
    ],
  ]);
  const [report] = classReport(members, assignments, rows, materials);

  it("shows each student's day, scores, and Day 1 to Day 7", () => {
    expect(report.students[0]).toMatchObject({
      displayName: "01 王小明",
      finished: true,
      passed: true,
      day1: 0.5,
      day7: 0.75,
      improvement: 25,
    });
    expect(report.students[0].dayScores).toEqual([
      0.5, 0.8, 0.8, 0.8, 0.8, 0.8, 0.75,
    ]);
    expect(report.students[1]).toMatchObject({
      daysDone: 6,
      nextDay: 7,
      finished: false,
    });
    expect(report.students[2]).toMatchObject({ started: false, daysDone: 0 });
  });

  it("lists who hasn't finished and the class's misheard words", () => {
    expect(report.unfinished).toEqual(["02 林小華", "03 陳小美"]);
    expect(report.missedWords[0]).toEqual({ word: "moved", count: 2 });
  });

  it("exports CSV for spreadsheets, quoting what needs it", () => {
    const csv = reportCsv(
      [report],
      [
        "作業",
        "截止",
        "學生",
        "天數",
        "狀態",
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "進步",
      ],
    );
    expect(csv.startsWith("﻿作業,")).toBe(true);
    expect(csv).toContain(
      "Sintel,2026-11-09,01 王小明,7,passed,50,80,80,80,80,80,75,25",
    );
    expect(csv).toContain("03 陳小美,0,in progress,,,,,,,,");
  });
});
