import { beforeEach, describe, expect, it, vi } from "vitest";
import { RATE_LIMITS } from "@/lib/rate-limits";

/** Rate limits (D63). */
const db = vi.hoisted(() => ({ rpc: vi.fn(), admin: true }));
vi.mock("@/auth/admin", () => ({
  getAdminSupabase: () => (db.admin ? { rpc: db.rpc } : null),
}));
vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }),
}));
const { allowAction } = await import("@/auth/rate-limit");

beforeEach(() => {
  db.admin = true;
  db.rpc.mockReset().mockResolvedValue({ data: true, error: null });
});

describe("allowAction", () => {
  it("counts per account with the action's window", async () => {
    expect(await allowAction("feedback", "u1")).toBe(true);
    expect(db.rpc).toHaveBeenCalledWith("hit_rate_limit", {
      limit_key: "feedback:u:u1",
      window_seconds: RATE_LIMITS.feedback.windowSeconds,
      max_hits: RATE_LIMITS.feedback.max,
    });
  });

  it("signed out, counts by a hash of the first forwarded IP, never the IP", async () => {
    await allowAction("troubleReport", null);
    const key = db.rpc.mock.calls[0][1].limit_key as string;
    expect(key).toMatch(/^troubleReport:ip:[0-9a-f]{32}$/);
    expect(key).not.toContain("203.0.113.7");
  });

  it("refuses over the limit, and fails open when it can't check", async () => {
    db.rpc.mockResolvedValue({ data: false, error: null });
    expect(await allowAction("report", "u1")).toBe(false);
    vi.spyOn(console, "error").mockImplementation(() => {});
    db.rpc.mockResolvedValue({ data: null, error: { message: "down" } });
    expect(await allowAction("report", "u1")).toBe(true);
    db.admin = false;
    expect(await allowAction("report", "u1")).toBe(true);
  });
});
