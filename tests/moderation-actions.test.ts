import { beforeEach, describe, expect, it, vi } from "vitest";

const uuid = "0b1d2c3e-4f50-4a6b-8c7d-9e0f1a2b3c4d";
type Call = { table: string; values: unknown; filters: unknown[][] };
const state = vi.hoisted(() => ({
  admin: true,
  calls: [] as Call[],
  rows: [{ id: "x" }] as unknown[],
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/auth/creator", () => ({
  getAdminUser: async () =>
    state.admin ? { id: "admin-1", email: "joe@example.com" } : null,
}));
vi.mock("@/auth/admin", () => ({
  getAdminSupabase: () => ({
    from: (table: string) => ({
      update: (values: unknown) => {
        const call: Call = { table, values, filters: [] };
        state.calls.push(call);
        const query = {
          eq: (...args: unknown[]) => {
            call.filters.push(["eq", ...args]);
            return query;
          },
          not: (...args: unknown[]) => {
            call.filters.push(["not", ...args]);
            return query;
          },
          select: async () => ({ data: state.rows, error: null }),
          then: (resolve: (value: unknown) => void) => resolve({ error: null }),
        };
        return query;
      },
    }),
  }),
}));

const { dismissReports, removePractice, restorePractice } =
  await import("@/app/admin/reports/actions");

beforeEach(() => {
  state.admin = true;
  state.calls = [];
  state.rows = [{ id: "x" }];
});

describe("moderation actions", () => {
  it("take a practice down with the reason and close its open reports", async () => {
    expect(await removePractice(uuid, "personal")).toEqual({ ok: true });
    expect(state.calls.map((c) => c.table)).toEqual([
      "practices",
      "practice_reports",
    ]);
    expect(state.calls[0].values).toMatchObject({
      removed_reason: "personal",
    });
    expect(state.calls[0].filters).toEqual([["eq", "id", uuid]]);
    expect(state.calls[1].values).toMatchObject({ status: "removed" });
    expect(state.calls[1].filters).toEqual([
      ["eq", "practice_id", uuid],
      ["eq", "status", "open"],
    ]);
  });

  it("dismiss only open reports", async () => {
    expect(await dismissReports(uuid)).toEqual({ ok: true });
    expect(state.calls[0]).toMatchObject({
      table: "practice_reports",
      values: { status: "dismissed" },
    });
    state.rows = [];
    expect(await dismissReports(uuid)).toEqual({
      ok: false,
      reason: "not-found",
    });
  });

  it("restore clears the takedown", async () => {
    expect(await restorePractice(uuid)).toEqual({ ok: true });
    expect(state.calls[0].values).toEqual({
      removed_at: null,
      removed_reason: null,
    });
  });

  it("are for admins only, with valid input", async () => {
    expect(await removePractice("nope", "spam")).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(await removePractice(uuid, "boring")).toEqual({
      ok: false,
      reason: "invalid",
    });
    state.admin = false;
    expect(await removePractice(uuid, "spam")).toEqual({
      ok: false,
      reason: "unavailable",
    });
    expect(state.calls).toEqual([]);
  });
});
