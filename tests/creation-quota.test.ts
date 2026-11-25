import { beforeEach, describe, expect, it, vi } from "vitest";
import { usageWeek } from "@/lib/usage-report";

/** The free plan's minutes a week (D143). */
describe("usageWeek", () => {
  it("runs Monday 00:00 to Monday 00:00, Taiwan time", () => {
    // Thursday 2026-11-12, 10:00 in Taipei.
    expect(usageWeek(new Date("2026-11-12T02:00:00Z"))).toEqual({
      start: "2026-11-08T16:00:00.000Z",
      end: "2026-11-15T16:00:00.000Z",
    });
    // Sunday 23:59 in Taipei: still that week.
    expect(usageWeek(new Date("2026-11-15T15:59:00Z")).start).toBe(
      "2026-11-08T16:00:00.000Z",
    );
    // Monday 00:00 in Taipei: a new week (still Sunday in UTC).
    expect(usageWeek(new Date("2026-11-15T16:00:00Z")).start).toBe(
      "2026-11-15T16:00:00.000Z",
    );
  });
});

const rows = vi.hoisted(() => ({
  data: [] as { seconds: number; created_at: string }[],
  table: "",
}));
vi.mock("@/auth/server", () => ({
  getServerSupabase: async () => ({
    from: (table: string) => {
      rows.table = table;
      const chain = {
        select: () => chain,
        eq: () => chain,
        gte: async () => ({ data: rows.data }),
      };
      return chain;
    },
  }),
}));

// Referral bonus grants (D177).
const referral = vi.hoisted(() => ({
  grants: [] as { minutes: number; grantedAt: string; expiresAt: string }[],
}));
vi.mock("@/auth/referral", () => ({
  getReferralGrants: async () => referral.grants,
}));

const { creationAllowance } = await import("@/auth/creation-quota");
const user = (plan?: "paid") => ({
  user: {
    id: "u1",
    email: "a@example.com",
    role: "user" as const,
    plan,
    practicesCreated: 3,
  },
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-12T02:00:00Z"));
  rows.data = [];
  referral.grants = [];
});

describe("creationAllowance (D143)", () => {
  it("counts this week's minutes from the kept record, not last week's", async () => {
    rows.data = [
      { seconds: 60, created_at: "2026-11-07T00:00:00+00:00" }, // last week
      { seconds: 45, created_at: "2026-11-10T03:00:00+00:00" },
    ];
    const { check, week } = await creationAllowance(user() as never);
    expect(rows.table).toBe("practice_creations");
    expect(check).toEqual({ ok: true });
    expect(week).toEqual({
      usedSeconds: 45,
      leftSeconds: 75,
      words: 300,
      resetsAt: "2026-11-15T16:00:00.000Z",
    });
  });

  it("stops at 2 minutes, however many practices that was", async () => {
    rows.data = [
      { seconds: 60, created_at: "2026-11-09T17:00:00+00:00" },
      { seconds: 60, created_at: "2026-11-11T17:00:00+00:00" },
    ];
    const { check, week } = await creationAllowance(user() as never);
    expect(check).toEqual({ ok: false, limit: "wordsPerWeek", max: 300 });
    expect(week?.leftSeconds).toBe(0);
  });

  it("has no week on the paid plans", async () => {
    const { week } = await creationAllowance(user("paid") as never);
    expect(week).toBeNull();
  });
});

describe("referral bonus minutes (D177)", () => {
  const grant = {
    minutes: 2,
    grantedAt: "2026-11-10T00:00:00Z",
    expiresAt: "2027-02-08T00:00:00Z",
  };

  it("adds them to the free plan's week once the plan's 2 are used", async () => {
    referral.grants = [grant];
    rows.data = [{ seconds: 120, created_at: "2026-11-10T03:00:00+00:00" }];
    const { check, week, bonusLeftSeconds } = await creationAllowance(
      user() as never,
    );
    expect(check).toEqual({ ok: true });
    // Two bonus minutes are 300 words (D209).
    expect(week).toMatchObject({ words: 600, leftSeconds: 120 });
    expect(bonusLeftSeconds).toBe(120);
  });

  it("adds them to the paid plans' month", async () => {
    referral.grants = [grant];
    const { plans, bonusLeftSeconds } = await creationAllowance(
      user("paid") as never,
    );
    expect(plans.paid.wordsPerMonth).toBe(6300);
    expect(bonusLeftSeconds).toBe(120);
  });

  it("ignores expired grants", async () => {
    referral.grants = [{ ...grant, expiresAt: "2026-11-11T00:00:00Z" }];
    const { week, bonusLeftSeconds } = await creationAllowance(user() as never);
    expect(week?.words).toBe(300);
    expect(bonusLeftSeconds).toBeNull();
  });
});
