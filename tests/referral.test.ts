import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PLANS } from "@/lib/plans";
import { createProgress, type Progress } from "@/lib/progress";
import {
  activityDevices,
  bonusPool,
  cleanReferralCode,
  day1Cutoff,
  finishedDay1Since,
  newReferralCode,
  REFERRAL_BONUS_MINUTES,
  REFERRAL_BURST,
  REFERRAL_QUALIFY_DAYS,
  REFERRAL_REFERRER_MONTHLY,
  referralUrl,
  referralVerdict,
  sharesDevice,
  summarizeReferrals,
  withBonus,
  type ReferralFacts,
} from "@/lib/referral";
import { usageWeek } from "@/lib/usage-report";

/** The referral program's rules (D177). */
const now = new Date("2026-11-14T04:00:00Z");
const facts = (over: Partial<ReferralFacts> = {}): ReferralFacts => ({
  referrerId: "a",
  refereeId: "b",
  createdAt: "2026-11-12T04:00:00Z",
  sameIp: false,
  sameDevice: false,
  burst: 1,
  day1: true,
  referrerRecentRewards: 0,
  now,
  ...over,
});

describe("referral codes and links", () => {
  it("makes 8-character codes and reads them back", () => {
    const code = newReferralCode();
    expect(code).toMatch(/^[A-Z2-9]{8}$/);
    expect(cleanReferralCode(` ${code.toLowerCase()} `)).toBe(code);
    expect(cleanReferralCode("short")).toBeNull();
    expect(referralUrl("https://x.test", code)).toBe(
      `https://x.test/r/${code}`,
    );
  });
});

describe("referralVerdict", () => {
  it("rewards both sides when the friend finished Day 1", () => {
    expect(referralVerdict(facts())).toEqual({
      status: "qualified",
      referrerMinutes: REFERRAL_BONUS_MINUTES,
      refereeMinutes: REFERRAL_BONUS_MINUTES,
    });
  });

  it("turns down the same person: own link, same IP, same device", () => {
    expect(referralVerdict(facts({ refereeId: "a" }))).toEqual({
      status: "rejected",
      reason: "self",
    });
    expect(referralVerdict(facts({ sameIp: true }))).toEqual({
      status: "rejected",
      reason: "same-ip",
    });
    expect(referralVerdict(facts({ sameDevice: true }))).toEqual({
      status: "rejected",
      reason: "same-device",
    });
  });

  it("turns down the third sign-up in a day through one link", () => {
    expect(referralVerdict(facts({ burst: REFERRAL_BURST - 1 })).status).toBe(
      "qualified",
    );
    expect(referralVerdict(facts({ burst: REFERRAL_BURST }))).toEqual({
      status: "rejected",
      reason: "burst",
    });
  });

  it("waits for Day 1, then expires", () => {
    expect(referralVerdict(facts({ day1: false }))).toEqual({
      status: "pending",
    });
    const old = new Date(
      now.getTime() - (REFERRAL_QUALIFY_DAYS + 1) * 86_400_000,
    ).toISOString();
    expect(referralVerdict(facts({ day1: false, createdAt: old }))).toEqual({
      status: "expired",
    });
  });

  it("stops the referrer's reward past the monthly cap, not the friend's", () => {
    expect(
      referralVerdict(
        facts({ referrerRecentRewards: REFERRAL_REFERRER_MONTHLY }),
      ),
    ).toEqual({
      status: "qualified",
      referrerMinutes: 0,
      refereeMinutes: REFERRAL_BONUS_MINUTES,
    });
  });
});

describe("Day 1 from cloud progress", () => {
  const withDay1 = (date: string): Progress => ({
    ...createProgress("sintel", date),
    days: { "1": { done: true, date, score: 0.8 } },
  });

  it("counts a Day 1 done since the day before signing up", () => {
    const since = day1Cutoff("2026-11-12T04:00:00Z");
    expect(since).toBe("2026-11-11");
    expect(finishedDay1Since([withDay1("2026-11-12")], since)).toBe(true);
    expect(finishedDay1Since([withDay1("2026-11-11")], since)).toBe(true);
    expect(finishedDay1Since([withDay1("2026-11-01")], since)).toBe(false);
  });

  it("counts a finished week, and ignores a started day or junk", () => {
    const started: Progress = {
      ...createProgress("sintel", "2026-11-12"),
      days: { "1": { done: false, answers: ["x", null] } },
    };
    expect(finishedDay1Since([started, null, "x", {}], "2026-11-11")).toBe(
      false,
    );
    const repeated: Progress = {
      ...createProgress("sintel", "2026-11-20"),
      week: 2,
      history: [
        {
          week: 1,
          startedAt: "2026-11-12",
          day1Score: 0.5,
          day7Score: 0.4,
          passed: false,
        },
      ],
    };
    expect(finishedDay1Since([repeated], "2026-11-11")).toBe(true);
  });
});

describe("devices from activity logs", () => {
  it("finds a device both accounts practiced on", () => {
    const log = (device: string) => ({
      days: {
        "2026-11-12": {
          official: true,
          retries: [],
          time: { [device]: { sintel: 60 } },
        },
      },
    });
    const a = activityDevices(log("d1"));
    expect([...a]).toEqual(["d1"]);
    expect(sharesDevice(a, activityDevices(log("d1")))).toBe(true);
    expect(sharesDevice(a, activityDevices(log("d2")))).toBe(false);
    expect(activityDevices(null).size).toBe(0);
  });
});

describe("the bonus pool", () => {
  const week = (iso: string) => usageWeek(new Date(iso)).start;
  const grant = (grantedAt: string, minutes = 2) => ({
    minutes,
    grantedAt,
    expiresAt: new Date(Date.parse(grantedAt) + 90 * 86_400_000).toISOString(),
  });
  // 2026-11-14 is a Saturday: the week began Monday 11-09 (Taiwan).
  const base = 120;

  it("adds every bonus minute to a week that hasn't used any", () => {
    expect(
      bonusPool({
        grants: [grant("2026-11-13T00:00:00Z")],
        creations: [],
        baseSeconds: base,
        periodOf: week,
        now,
      }),
    ).toEqual({ leftSeconds: 120, extraSeconds: 120 });
  });

  it("uses the bonus only beyond the plan, and keeps it used", () => {
    const pool = bonusPool({
      grants: [grant("2026-11-13T00:00:00Z")],
      creations: [
        { seconds: 120, createdAt: "2026-11-13T01:00:00Z" },
        { seconds: 60, createdAt: "2026-11-13T02:00:00Z" },
      ],
      baseSeconds: base,
      periodOf: week,
      now,
    });
    // 60 s over the plan this week: 60 s left, the week may use 120 s.
    expect(pool).toEqual({ leftSeconds: 60, extraSeconds: 120 });
    // Next week the plan starts over; what the bonus gave is gone.
    expect(
      bonusPool({
        grants: [grant("2026-11-13T00:00:00Z")],
        creations: [
          { seconds: 120, createdAt: "2026-11-13T01:00:00Z" },
          { seconds: 60, createdAt: "2026-11-13T02:00:00Z" },
        ],
        baseSeconds: base,
        periodOf: week,
        now: new Date("2026-11-18T04:00:00Z"),
      }),
    ).toEqual({ leftSeconds: 60, extraSeconds: 60 });
  });

  it("takes from the grant that expires first, and drops expired ones", () => {
    const older = grant("2026-08-20T00:00:00Z"); // expires 11-18
    const newer = grant("2026-11-13T00:00:00Z");
    const pool = bonusPool({
      grants: [newer, older],
      creations: [{ seconds: 180, createdAt: "2026-11-13T01:00:00Z" }],
      baseSeconds: base,
      periodOf: week,
      now,
    });
    expect(pool).toEqual({ leftSeconds: 180, extraSeconds: 240 });
    // After the older grant expires, only the newer one's 120 s are left.
    expect(
      bonusPool({
        grants: [newer, older],
        creations: [{ seconds: 180, createdAt: "2026-11-13T01:00:00Z" }],
        baseSeconds: base,
        periodOf: week,
        now: new Date("2026-11-19T04:00:00Z"),
      }).leftSeconds,
    ).toBe(120);
  });

  it("adds to the week's minutes on the free plan, the month's on paid", () => {
    expect(withBonus(PLANS.free, 120).minutesPerWeek).toBe(4);
    expect(withBonus(PLANS.paid, 120).minutesPerMonth).toBe(42);
    expect(withBonus(PLANS.admin, 120)).toBe(PLANS.admin);
  });
});

describe("summary and database", () => {
  it("counts invited, qualified, and minutes earned", () => {
    expect(
      summarizeReferrals(
        [
          { status: "qualified" },
          { status: "pending" },
          { status: "rejected" },
        ],
        [{ minutes: 2 }, { minutes: 2 }],
      ),
    ).toEqual({ invited: 3, qualified: 1, earnedMinutes: 4 });
  });

  it("only the server grants rewards (security definer, service role)", () => {
    const sql = readFileSync(
      "supabase/migrations/20261129010000_referrals.sql",
      "utf8",
    );
    expect(sql).toMatch(
      /revoke all on function public\.qualify_referral\([^)]*\)\s+from public, anon, authenticated/,
    );
    expect(sql).not.toMatch(/grant (insert|update|all)[^;]*to authenticated/);
  });
});
