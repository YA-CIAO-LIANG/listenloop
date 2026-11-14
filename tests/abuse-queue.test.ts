import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ABUSE, detectAbuse, parseAbuseSignals } from "@/lib/ops/abuse";
import { QUEUE, QUEUE_PRIORITY, queueKey } from "@/lib/queue";

/** Abuse detection and fair queueing (D162). */
const limit = (userId: string) => (userId === "admin" ? null : 200_000);

describe("abuse detection", () => {
  const empty = parseAbuseSignals({});

  it("flags many accounts from one IP without pausing them", () => {
    const flags = detectAbuse(
      { ...empty, signups: [{ ip: "h", users: ["a", "b", "c"] }] },
      limit,
    );
    expect(flags.map((f) => [f.userId, f.kind, f.suspend])).toEqual([
      ["a", "multi-signup", false],
      ["b", "multi-signup", false],
      ["c", "multi-signup", false],
    ]);
  });

  it("pauses AI for a burst of calls, but never an admin's", () => {
    const flags = detectAbuse(
      {
        ...empty,
        heavy: [
          { user: "a", calls: ABUSE.heavyCallsPerHour },
          { user: "b", calls: ABUSE.heavyCallsPerHour - 1 },
          { user: "admin", calls: 10_000 },
        ],
      },
      limit,
    );
    expect(flags).toEqual([
      {
        userId: "a",
        kind: "heavy-use",
        detail: { callsPerHour: 150 },
        suspend: true,
      },
    ]);
  });

  it("flags three days near the daily cap in a row", () => {
    const day = (d: string, micros: number) => ({ user: "a", day: d, micros });
    expect(
      detectAbuse(
        {
          ...empty,
          days: [
            day("2026-11-11", 190_000),
            day("2026-11-12", 185_000),
            day("2026-11-13", 200_000),
          ],
        },
        limit,
      ).map((f) => f.kind),
    ).toEqual(["capped-days"]);
    expect(
      detectAbuse(
        {
          ...empty,
          days: [day("2026-11-12", 190_000), day("2026-11-13", 100)],
        },
        limit,
      ),
    ).toEqual([]);
  });

  it("pauses AI when 3 people reported someone's materials", () => {
    expect(
      detectAbuse({ ...empty, reported: [{ user: "a", reporters: 3 }] }, limit),
    ).toEqual([
      {
        userId: "a",
        kind: "reported",
        detail: { reporters: 3 },
        suspend: true,
      },
    ]);
  });

  it("flags a referrer whose friends look like the same person (D177)", () => {
    expect(
      detectAbuse(
        {
          ...empty,
          referrals: [
            { user: "a", rejected: ABUSE.referralsRejected, day: 0 },
            { user: "b", rejected: 0, day: ABUSE.referralsPerDay },
            { user: "c", rejected: 1, day: 2 },
            { user: "admin", rejected: 9, day: 9 },
          ],
        },
        limit,
      ).map((f) => [f.userId, f.kind, f.suspend]),
    ).toEqual([
      ["a", "referral-farm", false],
      ["b", "referral-farm", false],
    ]);
    // The database's thresholds are the same numbers.
    const sql = readFileSync(
      "supabase/migrations/20261129010000_referrals.sql",
      "utf8",
    );
    expect(sql).toContain(
      `filter (where status = 'rejected') >= ${ABUSE.referralsRejected}`,
    );
    expect(sql).toContain(`interval '24 hours') >= ${ABUSE.referralsPerDay}`);
  });

  it("reads the database's answer defensively", () => {
    expect(parseAbuseSignals(null)).toEqual(empty);
    expect(
      parseAbuseSignals({ heavy: [{ user: 1, calls: "7" }], signups: [{}] }),
    ).toEqual({
      ...empty,
      heavy: [{ user: "1", calls: 7 }],
      signups: [{ ip: "", users: [] }],
    });
  });
});

describe("fair queue order", () => {
  const minute = 60_000;
  it("lets paying plans go first, but not for ever", () => {
    const t = Date.parse("2026-11-13T12:00:00Z");
    const freeEarly = queueKey(t, QUEUE_PRIORITY.free);
    const proLater = queueKey(t + 5 * minute, QUEUE_PRIORITY.pro);
    const proMuchLater = queueKey(t + 7 * minute, QUEUE_PRIORITY.pro);
    // Pro 5 minutes later still goes first; 7 minutes later doesn't.
    expect(proLater).toBeLessThan(freeEarly);
    expect(proMuchLater).toBeGreaterThan(freeEarly);
    expect(QUEUE_PRIORITY.paid).toBe(1);
  });

  it("uses the same head start as the database", () => {
    const sql = readFileSync(
      "supabase/migrations/20261126000000_abuse_and_queue.sql",
      "utf8",
    );
    expect(sql).toContain(`priority * ${QUEUE.headStartSeconds}`);
  });
});
