import { describe, expect, it } from "vitest";
import {
  activeDays,
  addDay,
  finishedLoop,
  loopCompletion,
  retention,
  taiwanDay,
  weeklyActive,
} from "@/lib/retention";

/** Retention and completion for the admin dashboard (D114). */
const at = (day: string, hour = 10) =>
  new Date(`${day}T${String(hour).padStart(2, "0")}:00:00+08:00`).toISOString();

describe("days", () => {
  it("are Taiwan calendar days", () => {
    expect(taiwanDay("2026-11-10T17:30:00Z")).toBe("2026-11-11");
    expect(addDay("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDay("2026-11-01", -1)).toBe("2026-10-31");
    expect(taiwanDay("not a date")).toBeNull();
    expect(taiwanDay(undefined)).toBeNull();
  });
});

describe("retention", () => {
  const users = [
    { user_id: "a", created_at: at("2026-10-01") },
    { user_id: "b", created_at: at("2026-10-01", 23) },
    { user_id: "c", created_at: at("2026-11-08") },
  ];
  const active = activeDays([
    { user_id: "a", created_at: at("2026-10-02") },
    { user_id: "a", created_at: at("2026-10-31") },
    { user_id: "b", created_at: at("2026-10-08") },
    { user_id: "c", created_at: at("2026-11-09") },
    { user_id: null, created_at: at("2026-11-09") },
  ]);

  it("counts who was active exactly N days after signing up", () => {
    const [d1, d7, d30] = retention(users, active, "2026-11-11", "2026-05-15");
    expect(d1).toMatchObject({ eligible: 3, retained: 2, rate: 2 / 3 });
    expect(d7).toMatchObject({ eligible: 2, retained: 1 });
    expect(d30).toMatchObject({ eligible: 2, retained: 1, rate: 0.5 });
  });

  it("leaves out users whose day N is today, still to come, or before the log", () => {
    const [d1] = retention(users, active, "2026-11-09", "2026-10-05");
    // c's day 1 is today; a's and b's day 1 is before the log.
    expect(d1).toMatchObject({ eligible: 0, retained: 0, rate: null });
  });
});

describe("weekly active", () => {
  it("counts people with any activity in each 7-day window", () => {
    const active = activeDays([
      { user_id: "a", created_at: at("2026-11-11") },
      { user_id: "b", created_at: at("2026-11-05") },
      { user_id: "b", created_at: at("2026-11-04") },
    ]);
    expect(weeklyActive(active, "2026-11-11", 2)).toEqual([
      { start: "2026-10-29", users: 1 },
      { start: "2026-11-05", users: 2 },
    ]);
  });
});

describe("7-day loop completion", () => {
  it("counts a material as finished once Day 7 is done", () => {
    expect(finishedLoop({ days: { 7: { done: true } } })).toBe(true);
    expect(finishedLoop({ days: {}, history: [{ week: 1 }] })).toBe(true);
    expect(finishedLoop({ days: { 3: { done: true } }, history: [] })).toBe(
      false,
    );
    expect(finishedLoop(null)).toBe(false);
  });

  it("gives the overall rate and each category's", () => {
    const rows = [
      { video_id: "sintel", data: { days: { 7: { done: true } } } },
      { video_id: "p-1", data: { days: {} } },
      { video_id: "p-2", data: { status: "passed" } },
      { video_id: "x", data: {} },
    ];
    const category = (id: string) =>
      ({ sintel: "talks-stories", "p-1": "travel", "p-2": "travel" })[id] ??
      null;
    const result = loopCompletion(rows, category);
    expect(result.overall).toEqual({ started: 4, finished: 2, rate: 0.5 });
    expect(result.byCategory).toEqual([
      { category: "travel", started: 2, finished: 1, rate: 0.5 },
      { category: "none", started: 1, finished: 0, rate: 0 },
      { category: "talks-stories", started: 1, finished: 1, rate: 1 },
    ]);
  });
});
