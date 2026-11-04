import { beforeEach, describe, expect, it, vi } from "vitest";
import { REPORT_LIMITS } from "@/lib/moderation";

const uuid = "0b1d2c3e-4f50-4a6b-8c7d-9e0f1a2b3c4d";
const state = vi.hoisted(() => ({
  user: { id: "user-1", email: "a@example.com" } as {
    id: string;
    email: string;
  } | null,
  todayCount: 0,
  insertError: null as { code: string } | null,
  inserted: [] as unknown[],
  since: "",
}));

vi.mock("@/auth/session", () => ({ getSignedInUser: async () => state.user }));
vi.mock("@/auth/server", () => ({
  getServerSupabase: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          gte: async (_: string, since: string) => {
            state.since = since;
            return { count: state.todayCount, error: null };
          },
        }),
      }),
      insert: async (row: unknown) => {
        state.inserted.push(row);
        return { error: state.insertError };
      },
    }),
  }),
}));

const { reportPractice } = await import("@/app/reports/actions");

beforeEach(() => {
  state.user = { id: "user-1", email: "a@example.com" };
  state.todayCount = 0;
  state.insertError = null;
  state.inserted = [];
});

describe("reportPractice", () => {
  it("saves the report for the practice's uuid", async () => {
    expect(
      await reportPractice(`p-${uuid}`, "copyright", "  from a textbook "),
    ).toEqual({ ok: true });
    expect(state.inserted).toEqual([
      {
        practice_id: uuid,
        reporter_id: "user-1",
        reason: "copyright",
        details: "from a textbook",
      },
    ]);
    // Counted from midnight in Taiwan.
    expect(state.since).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\+08:00$/);
  });

  it.each([
    ["a built-in video", "sintel", "spam", ""],
    ["an unknown reason", `p-${uuid}`, "boring", ""],
    ["overlong details", `p-${uuid}`, "other", "x".repeat(1001)],
  ])("rejects %s", async (_, id, reason, details) => {
    expect(await reportPractice(id, reason, details)).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(state.inserted).toEqual([]);
  });

  it("needs a signed-in user", async () => {
    state.user = null;
    expect(await reportPractice(`p-${uuid}`, "spam", "")).toEqual({
      ok: false,
      reason: "signed-out",
    });
  });

  it("stops at the daily limit", async () => {
    state.todayCount = REPORT_LIMITS.perDay;
    expect(await reportPractice(`p-${uuid}`, "spam", "")).toEqual({
      ok: false,
      reason: "limit",
    });
    expect(state.inserted).toEqual([]);
  });

  it.each([
    ["23505", "already"],
    ["42501", "not-found"],
    ["XX000", "failed"],
  ])("maps database error %s to %s", async (code, reason) => {
    state.insertError = { code };
    expect(await reportPractice(`p-${uuid}`, "spam", "")).toEqual({
      ok: false,
      reason,
    });
  });
});
