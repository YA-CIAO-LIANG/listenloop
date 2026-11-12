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
      minutes: 2,
      resetsAt: "2026-11-15T16:00:00.000Z",
    });
  });

  it("stops at 2 minutes, however many practices that was", async () => {
    rows.data = [
      { seconds: 60, created_at: "2026-11-09T17:00:00+00:00" },
      { seconds: 60, created_at: "2026-11-11T17:00:00+00:00" },
    ];
    const { check, week } = await creationAllowance(user() as never);
    expect(check).toEqual({ ok: false, limit: "minutesPerWeek", max: 2 });
    expect(week?.leftSeconds).toBe(0);
  });

  it("has no week on the paid plans", async () => {
    const { week } = await creationAllowance(user("paid") as never);
    expect(week).toBeNull();
  });
});
