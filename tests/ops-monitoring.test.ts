import { describe, expect, it, vi } from "vitest";
import {
  evaluateAlerts,
  healthStatus,
  newAlerts,
  type OpsSnapshot,
} from "@/lib/ops/alerts";
import { cronAuthorized } from "@/lib/ops/cron-auth";
import { capacityForecast, creditForecast } from "@/lib/ops/forecast";
import {
  alertLines,
  discordText,
  discordWebhook,
  sendDiscord,
} from "@/lib/ops/notify";
import { weeklyLines, type WeeklySummary } from "@/lib/ops/weekly";

/** Monitoring, alerts, forecasts, and the weekly summary (D156). */

const quiet: OpsSnapshot = {
  health: { db: "ok", storage: "ok", ai: "ok", speech: "ok", config: "ok" },
  errors15m: 0,
  errors7d: 70,
  todayMicros: 10_000,
  previousDaysMicros: [10_000, 12_000, 8_000],
  monthMicros: 1_000_000,
  monthCapMicros: 8_000_000,
  speechCharsMonth: 10_000,
  speechCharsCap: 500_000,
  audioSecondsMonth: 600,
  audioSecondsCap: 16_200,
  databaseBytes: 50 * 1024 * 1024,
  databaseCap: 500 * 1024 * 1024,
  storageBytes: 100 * 1024 * 1024,
  storageCap: 1024 * 1024 * 1024,
  signups1h: 1,
  reports1h: 0,
};
const keys = (s: OpsSnapshot) => evaluateAlerts(s).map((a) => a.key);

describe("alerts (D156)", () => {
  it("raises nothing on a quiet day", () => {
    expect(evaluateAlerts(quiet)).toEqual([]);
  });

  it("flags failed health checks, the database as critical", () => {
    const alerts = evaluateAlerts({
      ...quiet,
      health: { ...quiet.health, db: "fail", ai: "fail" },
    });
    expect(alerts[0]).toMatchObject({ key: "health:db,ai", level: "critical" });
    expect(healthStatus({ ...quiet.health, db: "fail" })).toBe("down");
    expect(healthStatus({ ...quiet.health, ai: "fail" })).toBe("degraded");
    expect(healthStatus({ ...quiet.health, ai: "skipped" })).toBe("ok");
  });

  it("flags a burst of errors only above the floor and the usual rate", () => {
    expect(keys({ ...quiet, errors15m: 9 })).toEqual([]);
    expect(keys({ ...quiet, errors15m: 12 })).toEqual(["errors:burst"]);
    // A noisy week: 12 in 15 minutes is ordinary.
    expect(keys({ ...quiet, errors15m: 12, errors7d: 6720 })).toEqual([]);
  });

  it("warns at 80% of an allowance and again when it's used up", () => {
    expect(keys({ ...quiet, monthMicros: 6_400_000 })).toEqual(["ai-month:80"]);
    expect(keys({ ...quiet, monthMicros: 8_000_000 })).toEqual([
      "ai-month:full",
    ]);
    expect(keys({ ...quiet, speechCharsMonth: 450_000 })).toEqual([
      "speech-month:80",
    ]);
    expect(keys({ ...quiet, audioSecondsMonth: 16_200 })).toEqual([
      "transcribe-month:full",
    ]);
  });

  it("flags a day spending over 3× the week's average, above US$0.10", () => {
    expect(keys({ ...quiet, todayMicros: 90_000 })).toEqual([]);
    expect(keys({ ...quiet, todayMicros: 150_000 })).toEqual(["spend:spike"]);
    expect(
      keys({ ...quiet, todayMicros: 150_000, previousDaysMicros: [] }),
    ).toEqual([]);
  });

  it("warns as Supabase's free tier fills", () => {
    expect(keys({ ...quiet, databaseBytes: 410 * 1024 * 1024 })).toEqual([
      "supabase-db:80",
    ]);
    expect(keys({ ...quiet, storageBytes: 900 * 1024 * 1024 })).toEqual([
      "supabase-storage:80",
    ]);
  });

  it("flags many sign-ups or reports in an hour", () => {
    expect(keys({ ...quiet, signups1h: 20, reports1h: 10 })).toEqual([
      "signups:burst",
      "reports:burst",
    ]);
  });

  it("doesn't send the same alert twice within 6 hours", () => {
    const now = new Date("2026-11-13T12:00:00Z");
    const alerts = evaluateAlerts({ ...quiet, signups1h: 30, reports1h: 30 });
    expect(
      newAlerts(
        alerts,
        [
          { key: "signups:burst", created_at: "2026-11-13T09:00:00Z" },
          { key: "reports:burst", created_at: "2026-11-13T05:00:00Z" },
        ],
        now,
      ).map((a) => a.key),
    ).toEqual(["reports:burst"]);
  });
});

describe("forecasts (D156)", () => {
  it("says when the credit runs out at the recent pace", () => {
    const forecast = creditForecast({
      dailyMicros: [1_000_000, 1_000_000],
      creditMicros: 100_000_000,
      spentMicros: 40_000_000,
      endsOn: "2027-11-04",
      today: new Date("2026-11-13T00:00:00Z"),
    });
    expect(forecast).toMatchObject({
      perDayMicros: 1_000_000,
      leftMicros: 60_000_000,
      runsOutOn: "2027-01-12",
      expiresFirst: false,
    });
  });

  it("says the credit lasts when nothing is spent or it expires first", () => {
    const base = {
      creditMicros: 100_000_000,
      spentMicros: 0,
      endsOn: "2027-11-04",
      today: new Date("2026-11-13T00:00:00Z"),
    };
    expect(creditForecast({ ...base, dailyMicros: [] }).runsOutOn).toBeNull();
    expect(
      creditForecast({ ...base, dailyMicros: [10_000] }).expiresFirst,
    ).toBe(true);
  });

  it("fits a line through the size samples", () => {
    const mb = 1024 * 1024;
    const forecast = capacityForecast(
      [
        { day: "2026-11-03", bytes: 100 * mb },
        { day: "2026-11-01", bytes: 80 * mb },
        { day: "2026-11-02", bytes: 90 * mb },
      ],
      500 * mb,
    );
    expect(forecast?.perDayBytes).toBeCloseTo(10 * mb);
    expect(forecast?.latestBytes).toBe(100 * mb);
    expect(forecast?.fullOn).toBe("2026-12-13");
    expect(capacityForecast([], 1)).toBeNull();
    expect(
      capacityForecast([{ day: "2026-11-01", bytes: 5 }], 10)?.fullOn,
    ).toBeNull();
  });
});

describe("notifications (D156)", () => {
  it("accepts only a Discord webhook URL", () => {
    expect(discordWebhook("https://discord.com/api/webhooks/1/abc")).toBe(
      "https://discord.com/api/webhooks/1/abc",
    );
    expect(discordWebhook("https://example.com/hook")).toBeNull();
    expect(discordWebhook(undefined)).toBeNull();
  });

  it("posts without pings, and never throws", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    expect(
      await sendDiscord(
        "hi",
        "https://discord.com/api/webhooks/1/abc",
        fetchImpl as unknown as typeof fetch,
      ),
    ).toBe(true);
    const body = JSON.parse(
      (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1]
        .body as string,
    );
    expect(body.allowed_mentions).toEqual({ parse: [] });
    const failing = vi.fn(async () => {
      throw new Error("down");
    });
    expect(
      await sendDiscord(
        "hi",
        "https://discord.com/api/webhooks/1/abc",
        failing as unknown as typeof fetch,
      ),
    ).toBe(false);
    expect(await sendDiscord("hi", null)).toBe(false);
  });

  it("keeps messages within Discord's length", () => {
    const text = discordText("T", ["x".repeat(5000)]);
    expect(text.length).toBeLessThanOrEqual(1901);
    expect(
      alertLines([{ key: "k", level: "critical", message: "m" }])[0],
    ).toContain("m");
  });
});

describe("cron routes' secret (D156)", () => {
  const secret = "s".repeat(32);
  it("is off without a long enough secret", () => {
    expect(cronAuthorized(`Bearer ${secret}`, undefined)).toBe("off");
    expect(cronAuthorized("Bearer short", "short")).toBe("off");
  });
  it("needs the exact secret", () => {
    expect(cronAuthorized(`Bearer ${secret}`, secret)).toBe("ok");
    expect(cronAuthorized(`Bearer ${secret}x`, secret)).toBe("unauthorized");
    expect(cronAuthorized(null, secret)).toBe("unauthorized");
  });
});

describe("weekly summary (D156)", () => {
  it("lists the week, the top costs, and the forecasts", () => {
    const summary: WeeklySummary = {
      weekStart: "2026-11-02",
      weekEnd: "2026-11-08",
      totalMicros: 1_230_000,
      byOperation: [
        {
          provider: "azure-openai",
          operation: "compose",
          calls: 3,
          micros: 30_000,
        },
      ],
      newUsers: 4,
      newPractices: 7,
      activeUsers: 12,
      credit: {
        perDayMicros: 100_000,
        leftMicros: 90_000_000,
        runsOutOn: "2029-01-01",
        expiresFirst: true,
        days: 30,
      },
      database: null,
      storage: { perDayBytes: 0, latestBytes: 0, fullOn: null },
    };
    const lines = weeklyLines(summary).join("\n");
    expect(lines).toContain("US$1.23");
    expect(lines).toContain("到期前用不完");
    expect(lines).toContain("新帳號 4");
  });
});
