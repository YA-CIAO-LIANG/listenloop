import { describe, expect, it } from "vitest";
import {
  classPrice,
  classStudentWriting,
  classWords,
  CLASS_TIERS,
  classTierFor,
  classReport,
  isInviteCode,
  newInviteCode,
  reportCsv,
} from "@/lib/classroom";
import { createProgress, withDay, type Progress } from "@/lib/progress";

describe("class plans (D103, D173, D210)", () => {
  it("are three sizes, each as listening, writing, or all-in-one", () => {
    expect(
      CLASS_TIERS.map(({ id, seats, monthly }) => [id, seats, monthly]),
    ).toEqual([
      ["small", 15, { listening: 349, writing: 299, all: 599 }],
      ["standard", 40, { listening: 549, writing: 449, all: 899 }],
      ["large", 100, { listening: 800, writing: 690, all: 1_390 }],
    ]);
    expect(CLASS_TIERS.map((tier) => classPrice(tier, "year"))).toEqual([
      5990, 8990, 13900,
    ]);
    expect(
      CLASS_TIERS.map((tier) => classPrice(tier, "month", "listening")),
    ).toEqual([349, 549, 800]);
  });

  it("give Joe's allowances: the teacher's words, each student's writing", () => {
    expect(CLASS_TIERS.map((tier) => tier.words)).toEqual([
      6_750, 10_500, 15_750,
    ]);
    expect(CLASS_TIERS.map((tier) => tier.perStudent)).toEqual([
      { essaysPerWeek: 2, backChecksPerWeek: 7, chatMessagesPerWeek: 15 },
      { essaysPerWeek: 2, backChecksPerWeek: 5, chatMessagesPerWeek: 0 },
      { essaysPerWeek: 2, backChecksPerWeek: 3, chatMessagesPerWeek: 0 },
    ]);
  });

  it("put every seat count in the smallest tier that holds it", () => {
    expect(classTierFor(10).id).toBe("small");
    expect(classTierFor(15).id).toBe("small");
    expect(classTierFor(20).id).toBe("standard");
    expect(classTierFor(40).id).toBe("standard");
    expect(classTierFor(80).id).toBe("large");
    expect(classTierFor(100).id).toBe("large");
    expect(classWords(15)).toBe(6_750);
    // An earlier grant keeps working, with its tier's words.
    expect(classWords(20)).toBe(10_500);
    expect(classWords(null)).toBeNull();
    // A writing class gives the teacher no words, its students writing.
    expect(classWords(40, "writing")).toBeNull();
    expect(classStudentWriting(40, "listening")).toBeNull();
    expect(classStudentWriting(40, "all")).toEqual(CLASS_TIERS[1].perStudent);
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
