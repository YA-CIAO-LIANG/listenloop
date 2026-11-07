import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanClientEvent, EVENT_TYPES } from "@/lib/events";

/** The activity log (D55). */
const db = vi.hoisted(() => ({
  insert: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
}));
vi.mock("@/auth/admin", () => ({
  getAdminSupabase: () => ({
    from: (table: string) =>
      table === "events"
        ? { insert: db.insert }
        : { update: (row: unknown) => (db.update(row), { eq: db.eq }) },
  }),
}));
const session = vi.hoisted(() => ({ user: null as { id: string } | null }));
vi.mock("@/auth/session", () => ({
  getSignedInUser: async () => session.user,
}));

const { logEvent } = await import("@/auth/events");
const { recordEvent } = await import("@/app/events/actions");

beforeEach(() => {
  db.insert.mockReset().mockResolvedValue({ error: null });
  db.update.mockReset();
  db.eq.mockReset().mockResolvedValue({ error: null });
  session.user = { id: "u1" };
});

describe("cleanClientEvent", () => {
  it("keeps what the browser may report", () => {
    expect(
      cleanClientEvent({
        type: "day_complete",
        videoId: "p-123e4567-e89b-12d3-a456-426614174000",
        day: 3,
        score: 0.8,
      }),
    ).toEqual({
      type: "day_complete",
      videoId: "p-123e4567-e89b-12d3-a456-426614174000",
      day: 3,
      score: 0.8,
      code: null,
    });
  });

  it.each([
    { type: "sign_in" },
    { type: "practice_create" },
    { type: "retry", day: 8 },
    { type: "retry", score: 1.5 },
    { type: "retry", videoId: "<script>" },
    { type: "recognition_fail", code: "x".repeat(41) },
    "retry",
  ])("refuses %j", (raw) => {
    expect(cleanClientEvent(raw)).toBeNull();
  });
});

describe("logEvent", () => {
  it("writes only ids and fields, and notes the last activity", async () => {
    await logEvent("u1", { type: "report", videoId: "p-1", code: "spam" });
    expect(db.insert).toHaveBeenCalledWith({
      user_id: "u1",
      type: "report",
      video_id: "p-1",
      day: null,
      score: null,
      code: "spam",
    });
    expect(db.update).toHaveBeenCalledWith({
      last_seen_at: expect.any(String),
    });
  });

  it("never throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    db.insert.mockResolvedValue({ error: { message: "down" } });
    await expect(logEvent(null, { type: "sign_in" })).resolves.toBeUndefined();
  });
});

describe("recordEvent", () => {
  it("logs a signed-in learner's event", async () => {
    await recordEvent({ type: "retry", videoId: "sintel", day: 2 });
    expect(db.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "u1", type: "retry" }),
    );
  });

  it("logs nothing when signed out or for server-only types", async () => {
    session.user = null;
    await recordEvent({ type: "retry", videoId: "sintel", day: 2 });
    session.user = { id: "u1" };
    await recordEvent({ type: "account_delete" });
    expect(db.insert).not.toHaveBeenCalled();
  });
});

describe("event types", () => {
  it("match the database's list", async () => {
    const { readFileSync } = await import("node:fs");
    const sql = readFileSync(
      "supabase/migrations/20261107160000_events.sql",
      "utf8",
    );
    for (const type of EVENT_TYPES) expect(sql).toContain(`'${type}'`);
  });
});
