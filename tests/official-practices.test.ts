import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: { id: "admin-1" } as { id: string } | null,
  admin: true,
  own: { id: "p1" } as unknown,
  copy: "copy-1" as string | null,
  rpc: vi.fn(),
  filters: [] as [string, string, unknown][],
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const logAudit = vi.hoisted(() => vi.fn());
vi.mock("@/auth/audit", () => ({ logAudit }));
vi.mock("@/auth/creator", () => ({ getAdminUser: async () => state.user }));
vi.mock("@/auth/admin", () => ({
  getAdminSupabase: () =>
    state.admin
      ? {
          from: () => {
            const chain = {
              select: () => chain,
              eq: (c: string, v: unknown) => (
                state.filters.push(["eq", c, v]),
                chain
              ),
              is: (c: string, v: unknown) => (
                state.filters.push(["is", c, v]),
                chain
              ),
              maybeSingle: async () => ({ data: state.own, error: null }),
            };
            return chain;
          },
          rpc: async (name: string, args: unknown) => (
            state.rpc(name, args),
            { data: state.copy, error: null }
          ),
        }
      : null,
}));

const { copyAsOfficial } = await import("@/app/materials/organize-actions");
const id = "00000000-0000-4000-8000-000000000001";

beforeEach(() => {
  state.user = { id: "admin-1" };
  state.admin = true;
  state.own = { id };
  state.copy = "copy-1";
  state.rpc.mockReset();
  state.filters = [];
  logAudit.mockReset();
});

describe("copyAsOfficial (D80)", () => {
  it("copies the admin's own practice to an official draft, keeping it", async () => {
    expect(await copyAsOfficial(id)).toEqual({ ok: true, id: "copy-1" });
    expect(state.filters).toEqual([
      ["eq", "id", id],
      ["eq", "user_id", "admin-1"],
      ["is", "removed_at", null],
    ]);
    expect(state.rpc).toHaveBeenCalledWith("copy_practice_as_official", {
      source: id,
      actor: "admin-1",
    });
    expect(logAudit).toHaveBeenCalledWith(
      "admin-1",
      "practice.copy-official",
      { type: "practice", id: "copy-1" },
      { from: id },
    );
  });

  it("says when it isn't theirs, is invalid, or isn't available", async () => {
    state.own = null;
    expect(await copyAsOfficial(id)).toEqual({
      ok: false,
      reason: "not-found",
    });
    expect(state.rpc).not.toHaveBeenCalled();
    expect(await copyAsOfficial("x")).toEqual({
      ok: false,
      reason: "invalid",
    });
    state.user = null;
    expect(await copyAsOfficial(id)).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });
});
