import { describe, expect, it } from "vitest";
import {
  parseTesterRows,
  summarizeCohort,
  summarizeTester,
  type TesterRow,
} from "@/lib/beta-test";

const NOW = new Date("2026-11-20T12:00:00Z");
const ago = (days: number) =>
  new Date(NOW.getTime() - days * 86_400_000).toISOString();

const tester = (over: Partial<TesterRow> = {}): TesterRow => ({
  userId: "u1",
  number: 7,
  inviteId: "i1",
  inviteNote: null,
  joinedAt: ago(4),
  lastSignInAt: ago(1),
  lastActivity: ago(1),
  progress: [
    {
      video: "sintel",
      week: 1,
      status: "in-progress",
      done: [1, 2],
      weeks: 0,
      updated: ago(1),
    },
  ],
  ...over,
});

describe("Beta test (D165)", () => {
  it("summarizes a tester's progress and the day-3 interview", () => {
    const s = summarizeTester(tester(), NOW);
    expect(s).toMatchObject({
      materials: 1,
      current: { video: "sintel", week: 1, day: 2 },
      startedDay1: true,
      finishedWeek: false,
      daysSinceJoin: 4,
      daysIdle: 1,
      followUp: null,
      interview: "day3",
    });
  });

  it("flags 2 days without practice, and not starting after a day", () => {
    expect(
      summarizeTester(tester({ lastActivity: ago(2) }), NOW).followUp,
    ).toBe("idle");
    expect(
      summarizeTester(
        tester({ progress: [], lastActivity: null, joinedAt: ago(1) }),
        NOW,
      ).followUp,
    ).toBe("notStarted");
    expect(
      summarizeTester(
        tester({ progress: [], lastActivity: null, joinedAt: ago(0.5) }),
        NOW,
      ).followUp,
    ).toBeNull();
  });

  it("counts a finished week and the day-14 interview", () => {
    const s = summarizeTester(
      tester({
        joinedAt: ago(15),
        progress: [
          {
            video: "sintel",
            week: 2,
            status: "in-progress",
            done: [],
            weeks: 1,
            updated: ago(1),
          },
        ],
      }),
      NOW,
    );
    expect(s.finishedWeek).toBe(true);
    expect(s.interview).toBe("day14");
    expect(s.current?.day).toBe(0);
  });

  it("adds up the cohort", () => {
    const summaries = [
      summarizeTester(tester(), NOW),
      summarizeTester(tester({ lastActivity: ago(5) }), NOW),
      summarizeTester(
        tester({ progress: [], lastActivity: null, joinedAt: ago(3) }),
        NOW,
      ),
    ];
    expect(summarizeCohort(summaries)).toEqual({
      testers: 3,
      startedDay1: 2,
      finishedWeek: 0,
      activeRecently: 1,
      followUps: 2,
    });
  });

  it("reads the database's rows and skips broken ones", () => {
    expect(
      parseTesterRows([
        null,
        { user_id: 1 },
        {
          user_id: "u",
          number: "12",
          invite_id: "i",
          invite_note: null,
          joined_at: ago(1),
          last_sign_in_at: null,
          last_activity: null,
          progress: [{ video: "x", week: "2", done: [1, "3"], weeks: 0 }],
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        userId: "u",
        number: 12,
        progress: [expect.objectContaining({ week: 2, done: [1, 3] })],
      }),
    ]);
  });
});
