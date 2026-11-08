import { describe, expect, it } from "vitest";
import {
  classMinutes,
  classPrice,
  classReport,
  classSaving,
  isInviteCode,
  newInviteCode,
  reportCsv,
} from "@/lib/classroom";
import { createProgress, withDay, type Progress } from "@/lib/progress";

describe("class plans (D103)", () => {
  it("are Joe's prices: a year is 9 months, two years 16", () => {
    expect(classPrice(10, "month")).toBe(590);
    expect(classPrice(10, "year")).toBe(590 * 9);
    expect(classPrice(100, "twoYear")).toBe(3990 * 16);
    expect(classSaving("year")).toBe(25);
    expect(classSaving("twoYear")).toBe(33);
    expect([10, 20, 40, 80, 100].map((s) => classMinutes(s as 10))).toEqual([
      60, 100, 160, 240, 300,
    ]);
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
