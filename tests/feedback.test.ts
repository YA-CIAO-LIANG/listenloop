import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanFeedback, FEEDBACK_PER_DAY } from "@/lib/feedback";

/** Feedback (D60). */
describe("cleanFeedback", () => {
  it("keeps a category, a tidy message, and a path on this site", () => {
    expect(
      cleanFeedback({
        category: "bug",
        message: "  It   broke. ",
        page: "/videos/sintel",
      }),
    ).toEqual({
      category: "bug",
      message: "It broke.",
      page: "/videos/sintel",
    });
    expect(
      cleanFeedback({
        category: "bug",
        message: "Hi",
        page: "https://evil.example",
      }),
    ).toMatchObject({ page: null });
  });

  it.each([
    { category: "praise", message: "Hi" },
    { category: "bug", message: "   " },
    { category: "bug", message: "x".repeat(2001) },
    null,
  ])("refuses %j", (raw) => {
    expect(cleanFeedback(raw)).toBeNull();
  });
});

const db = vi.hoisted(() => ({ count: 0, insert: vi.fn() }));
const session = vi.hoisted(() => ({ user: null as { id: string } | null }));
vi.mock("@/auth/session", () => ({
  getSignedInUser: async () => session.user,
}));
vi.mock("@/auth/admin", () => ({
  getAdminSupabase: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ gte: async () => ({ count: db.count }) }),
      }),
      insert: db.insert,
    }),
  }),
}));
const { submitFeedback } = await import("@/app/feedback/actions");

beforeEach(() => {
  db.count = 0;
  db.insert.mockReset().mockResolvedValue({ error: null });
  session.user = null;
});

describe("submitFeedback", () => {
  it("saves signed-out feedback without an account", async () => {
    expect(
      await submitFeedback({ category: "suggestion", message: "More news!" }),
    ).toEqual({ ok: true });
    expect(db.insert).toHaveBeenCalledWith({
      user_id: null,
      category: "suggestion",
      message: "More news!",
      page: null,
    });
  });

  it("stops a signed-in account at the daily limit", async () => {
    session.user = { id: "u1" };
    db.count = FEEDBACK_PER_DAY;
    expect(await submitFeedback({ category: "bug", message: "x" })).toEqual({
      ok: false,
      reason: "limit",
    });
    expect(db.insert).not.toHaveBeenCalled();
  });
});
