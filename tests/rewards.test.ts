import { describe, expect, it } from "vitest";
import {
  emptyActivity,
  officialDates,
  parseActivity,
  recordOfficial,
  recordRetry,
} from "@/lib/activity";
import type { CycleDay } from "@/lib/cycle";
import { createProgress, withDay, type DayRecord } from "@/lib/progress";
import {
  REWARDS,
  feedRewards,
  pointRewards,
  streakPoints,
  type Reward,
} from "@/lib/rewards";
import {
  claim,
  emptyWallet,
  feedBalance,
  parseWallet,
  pointBalance,
} from "@/lib/wallet";

const TODAY = "2026-10-27";

function progressWith(
  days: Partial<Record<CycleDay, DayRecord>>,
  videoId = "sintel",
) {
  let progress = createProgress(videoId, "2026-10-20");
  for (const [day, record] of Object.entries(days)) {
    progress = withDay(progress, Number(day) as CycleDay, record!);
  }
  return progress;
}

const amountOf = (rewards: Reward[], id: string) =>
  rewards.find((reward) => reward.id === id)?.amount;

describe("activity", () => {
  it("records official days and retries once each", () => {
    let activity = recordOfficial(emptyActivity(), TODAY);
    expect(recordOfficial(activity, TODAY)).toBe(activity);
    activity = recordRetry(activity, TODAY, "sintel");
    expect(recordRetry(activity, TODAY, "sintel")).toBe(activity);
    expect(activity.days[TODAY]).toEqual({
      official: true,
      retries: ["sintel"],
    });
  });

  it("merges logged days with completion dates from progress", () => {
    const activity = recordOfficial(emptyActivity(), "2026-10-25");
    const progress = progressWith({
      1: { done: true, date: "2026-10-21", score: 0.5 },
      2: { done: true, date: "2026-10-25" },
      3: { done: false },
    });
    expect(officialDates(activity, [progress])).toEqual([
      "2026-10-21",
      "2026-10-25",
    ]);
  });

  it("treats malformed data as missing", () => {
    expect(parseActivity({ days: { "2026-13-01": {} } })).toBeNull();
    expect(parseActivity({ days: {} })).toEqual({ days: {} });
  });
});

describe("pointRewards", () => {
  it("gives 10 a day plus the Day 1 / Day 7 accuracy bonus", () => {
    const rewards = pointRewards(
      [progressWith({ 1: { done: true, date: "2026-10-20", score: 0.64 } })],
      emptyActivity(),
    );
    expect(amountOf(rewards, "day:sintel:w1:d1")).toBe(10 + 6);
  });

  it("adds the shadowing bonus at 90% recognized coverage, ignoring manual sentences", () => {
    const rewards = pointRewards(
      [
        progressWith({
          2: {
            done: true,
            date: "2026-10-21",
            sentences: [
              { done: true, coverage: 0.9 },
              { done: true, coverage: null },
            ],
          },
          3: {
            done: true,
            date: "2026-10-22",
            sentences: [{ done: true, coverage: 0.85 }],
          },
          4: {
            done: true,
            date: "2026-10-23",
            sentences: [{ done: true, coverage: null }],
          },
        }),
      ],
      emptyActivity(),
    );
    expect(amountOf(rewards, "day:sintel:w1:d2")).toBe(15);
    expect(amountOf(rewards, "day:sintel:w1:d3")).toBe(10);
    expect(amountOf(rewards, "day:sintel:w1:d4")).toBe(10);
  });

  it("rewards each settled week, passed or not", () => {
    const progress = {
      ...progressWith({}),
      week: 3,
      history: [
        {
          week: 1,
          startedAt: "2026-10-01",
          day1Score: 0.5,
          day7Score: 0.6,
          passed: false,
        },
        {
          week: 2,
          startedAt: "2026-10-08",
          day1Score: 0.6,
          day7Score: 0.9,
          passed: true,
        },
      ],
    };
    const rewards = pointRewards([progress], emptyActivity());
    expect(amountOf(rewards, "week:sintel:w1")).toBe(REWARDS.weekRepeat);
    expect(amountOf(rewards, "week:sintel:w2")).toBe(REWARDS.weekPassed);
  });

  it("gives a retry bonus once per video per day", () => {
    let activity = recordRetry(emptyActivity(), TODAY, "sintel");
    activity = recordRetry(activity, TODAY, "voa-001");
    const rewards = pointRewards([], activity);
    expect(rewards.map((r) => r.id).sort()).toEqual([
      `retry:sintel:${TODAY}`,
      `retry:voa-001:${TODAY}`,
    ]);
    expect(rewards.every((r) => r.amount === 2)).toBe(true);
  });
});

describe("streakPoints", () => {
  const days = (n: number, from = 1) =>
    Array.from(
      { length: n },
      (_, i) => `2026-10-${String(from + i).padStart(2, "0")}`,
    );

  it("starts on day 3 and grows by 5 up to 20", () => {
    expect(streakPoints(days(10)).map((r) => r.amount)).toEqual([
      5, 10, 15, 20, 20, 20, 20, 20,
    ]);
    expect(streakPoints(days(10))[0].id).toBe("streak:2026-10-03");
  });

  it("starts over after a missed day", () => {
    const dates = [...days(3, 1), ...days(3, 5)];
    expect(streakPoints(dates).map((r) => r.id)).toEqual([
      "streak:2026-10-03",
      "streak:2026-10-07",
    ]);
  });

  it("counts across months", () => {
    expect(
      streakPoints(["2026-09-29", "2026-09-30", "2026-10-01"]),
    ).toHaveLength(1);
  });
});

describe("feedRewards", () => {
  it("gives one portion to start and one per day with an official task", () => {
    const progresses = [
      progressWith(
        { 1: { done: true, date: "2026-10-20", score: 1 } },
        "sintel",
      ),
      progressWith(
        { 1: { done: true, date: "2026-10-20", score: 1 } },
        "voa-001",
      ),
    ];
    const activity = recordRetry(emptyActivity(), "2026-10-21", "sintel");
    expect(feedRewards(progresses, activity, TODAY)).toEqual([
      { id: "feed:starter", amount: 1, date: "2026-10-20" },
      { id: "feed:2026-10-20", amount: 1, date: "2026-10-20" },
    ]);
  });

  it("dates the starter portion today before any practice", () => {
    expect(feedRewards([], emptyActivity(), TODAY)).toEqual([
      { id: "feed:starter", amount: 1, date: TODAY },
    ]);
  });
});

describe("wallet", () => {
  const points = [{ id: "day:sintel:w1:d1", amount: 16, date: TODAY }];
  const feed = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `feed:2026-10-${String(i + 1).padStart(2, "0")}`,
      amount: 1,
      date: `2026-10-${String(i + 1).padStart(2, "0")}`,
    }));

  it("claims each reward once", () => {
    const first = claim(emptyWallet(), points, feed(1));
    expect(first.gained).toEqual({ points: 16, feed: 1 });
    expect(pointBalance(first.wallet)).toBe(16);
    expect(feedBalance(first.wallet)).toBe(1);

    const again = claim(first.wallet, points, feed(1));
    expect(again.wallet).toBe(first.wallet);
    expect(again.gained).toEqual({ points: 0, feed: 0 });
  });

  it("stops feed at the cap and never pays the skipped portions later", () => {
    const { wallet, gained } = claim(emptyWallet(), [], feed(9));
    expect(gained.feed).toBe(REWARDS.feedCap);
    expect(feedBalance(wallet)).toBe(7);
    expect(wallet.feed.earned).toHaveLength(9);
    expect(wallet.feed.earned.at(-1)?.amount).toBe(0);

    // After feeding twice, only new days add feed again.
    const fed = {
      ...wallet,
      feed: {
        ...wallet.feed,
        used: [
          { id: "fed:1", amount: 1, date: TODAY },
          { id: "fed:2", amount: 1, date: TODAY },
        ],
      },
    };
    expect(claim(fed, [], feed(9)).gained.feed).toBe(0);
    expect(claim(fed, [], feed(10)).gained.feed).toBe(1);
  });

  it("treats malformed data as an empty wallet", () => {
    expect(parseWallet(emptyWallet())).toEqual(emptyWallet());
    expect(
      parseWallet({
        points: { earned: [{ id: "x", amount: -1, date: TODAY }], spent: [] },
        feed: { earned: [], used: [] },
      }),
    ).toBeNull();
    expect(parseWallet(null)).toBeNull();
  });
});
