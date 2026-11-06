import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: { id: "admin-1", email: "joe@example.com" } as { id: string } | null,
  admin: true,
  updates: [] as { row: unknown; filters: [string, string, unknown][] }[],
  rows: [{ id: "p1" }] as unknown[],
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/auth/creator", () => ({ getAdminUser: async () => state.user }));
vi.mock("@/auth/admin", () => ({
  getAdminSupabase: () =>
    state.admin
      ? {
          from: () => ({
            update: (row: unknown) => {
              const filters: [string, string, unknown][] = [];
              const chain = {
                eq: (c: string, v: unknown) => (
                  filters.push(["eq", c, v]),
                  chain
                ),
                is: (c: string, v: unknown) => (
                  filters.push(["is", c, v]),
                  chain
                ),
                select: async () => {
                  state.updates.push({ row, filters });
                  return { data: state.rows, error: null };
                },
              };
              return chain;
            },
          }),
        }
      : null,
}));

const { setOfficial } = await import("@/app/materials/organize-actions");
const id = "00000000-0000-4000-8000-000000000001";

beforeEach(() => {
  state.user = { id: "admin-1" };
  state.admin = true;
  state.updates = [];
  state.rows = [{ id }];
});

describe("setOfficial", () => {
  it("marks the admin's own practice official and public, with the secret key", async () => {
    expect(await setOfficial(id, true)).toEqual({ ok: true });
    expect(state.updates).toEqual([
      {
        row: { official: true, visibility: "public" },
        filters: [
          ["eq", "id", id],
          ["eq", "user_id", "admin-1"],
          ["is", "removed_at", null],
        ],
      },
    ]);
  });

  it("unmarks without changing visibility", async () => {
    await setOfficial(id, false);
    expect(state.updates[0].row).toEqual({ official: false });
  });

  it("says when it isn't theirs, is invalid, or isn't available", async () => {
    state.rows = [];
    expect(await setOfficial(id, true)).toEqual({
      ok: false,
      reason: "not-found",
    });
    expect(await setOfficial("x", true)).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(await setOfficial(id, "yes")).toEqual({
      ok: false,
      reason: "invalid",
    });
    state.user = null;
    expect(await setOfficial(id, true)).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });
});
