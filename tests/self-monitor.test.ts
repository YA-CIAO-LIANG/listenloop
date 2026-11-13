import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  SELF_MONITOR,
  dailyWindow,
  selfMonitorEnabled,
  taiwanHour,
} from "@/lib/ops/self-monitor";

/** The monitor started from the health check (D163). */
describe("self monitor (D163)", () => {
  it("runs every 15 minutes with 5-minute checks", () => {
    const gap = SELF_MONITOR.monitorGapSeconds;
    // Checks at 0, 5, 10, 15 minutes: the claim at 15 succeeds (> gap).
    expect(10 * 60).toBeLessThan(gap);
    expect(15 * 60).toBeGreaterThan(gap);
  });

  it("does the daily chores from 03:00 Taiwan time", () => {
    expect(taiwanHour(new Date("2026-11-12T18:59:00Z"))).toBe(2);
    expect(dailyWindow(new Date("2026-11-12T18:59:00Z"))).toBe(false);
    expect(dailyWindow(new Date("2026-11-12T19:00:00Z"))).toBe(true);
    expect(dailyWindow(new Date("2026-11-13T15:30:00Z"))).toBe(true);
  });

  it("is off in the end-to-end tests", () => {
    expect(selfMonitorEnabled({})).toBe(true);
    expect(selfMonitorEnabled({ SELF_MONITOR: "off" })).toBe(false);
    const config = readFileSync("playwright.config.ts", "utf8");
    expect(config).toMatch(/SELF_MONITOR: "off"/);
  });

  it("claims each run in the database, only for the secret key", () => {
    const sql = readFileSync(
      "supabase/migrations/20261127000000_ops_runs.sql",
      "utf8",
    );
    expect(sql).toMatch(/on conflict \(name\) do update/);
    expect(sql).toMatch(
      /revoke all on function public\.claim_ops_run\(text, integer\) from public, anon, authenticated/,
    );
  });
});
