import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanName,
  isUuid,
  isVisibility,
} from "@/lib/custom-practice/organize";

type Call = {
  table: string;
  op: string;
  values?: unknown;
  eq?: [string, unknown];
};
const state = vi.hoisted(() => ({
  admin: true,
  calls: [] as Call[],
  rows: [{ id: "x" }] as unknown[] | null,
  error: null as unknown,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/auth/creator", () => ({
  getAdminUser: async () =>
    state.admin ? { id: "user-1", email: "joe@example.com" } : null,
}));
vi.mock("@/auth/server", () => ({
  getServerSupabase: async () => ({
    from: (table: string) => {
      const call: Call = { table, op: "" };
      state.calls.push(call);
      const done = {
        select: async () => ({ data: state.rows, error: state.error }),
      };
      const filtered = {
        eq: (column: string, value: unknown) => {
          call.eq = [column, value];
          return done;
        },
      };
      return {
        insert: (values: unknown) => (
          (call.op = "insert"),
          (call.values = values),
          done
        ),
        update: (values: unknown) => (
          (call.op = "update"),
          (call.values = values),
          filtered
        ),
        delete: () => ((call.op = "delete"), filtered),
      };
    },
  }),
}));

const actions = await import("@/app/create/organize-actions");
const id = "0b1d2c3e-4f50-4a6b-8c7d-9e0f1a2b3c4d";
const other = "1b1d2c3e-4f50-4a6b-8c7d-9e0f1a2b3c4d";

beforeEach(() => {
  state.admin = true;
  state.calls = [];
  state.rows = [{ id: "x" }];
  state.error = null;
});

describe("organize checks", () => {
  it("tidies names and enforces the length", () => {
    expect(cleanName("  Week   1 ", 100)).toBe("Week 1");
    expect(cleanName("   ", 100)).toBeNull();
    expect(cleanName("x".repeat(101), 100)).toBeNull();
    expect(cleanName(3, 100)).toBeNull();
  });

  it("knows visibilities and uuids", () => {
    expect(isVisibility("public")).toBe(true);
    expect(isVisibility("friends")).toBe(false);
    expect(isUuid(id)).toBe(true);
    expect(isUuid("../etc")).toBe(false);
  });
});

describe("organize actions", () => {
  it("creates a collection for the signed-in admin", async () => {
    expect(await actions.createCollection(" Week 1 ")).toEqual({ ok: true });
    expect(state.calls).toEqual([
      {
        table: "collections",
        op: "insert",
        values: { user_id: "user-1", title: "Week 1" },
      },
    ]);
  });

  it("renames, shares, moves, and deletes by id", async () => {
    await actions.renameCollection(id, "New");
    await actions.setVisibility("practice", id, "public");
    await actions.setVisibility("collection", id, "private");
    await actions.movePractice(id, other);
    await actions.movePractice(id, null);
    await actions.deleteCollection(id);
    await actions.deletePractice(id);
    expect(state.calls).toEqual([
      {
        table: "collections",
        op: "update",
        values: { title: "New" },
        eq: ["id", id],
      },
      {
        table: "practices",
        op: "update",
        values: { visibility: "public" },
        eq: ["id", id],
      },
      {
        table: "collections",
        op: "update",
        values: { visibility: "private" },
        eq: ["id", id],
      },
      {
        table: "practices",
        op: "update",
        values: { collection_id: other },
        eq: ["id", id],
      },
      {
        table: "practices",
        op: "update",
        values: { collection_id: null },
        eq: ["id", id],
      },
      { table: "collections", op: "delete", eq: ["id", id] },
      { table: "practices", op: "delete", eq: ["id", id] },
    ]);
  });

  it.each([
    ["an empty name", () => actions.createCollection(" ")],
    ["a bad id", () => actions.deletePractice("nope")],
    [
      "a bad visibility",
      () => actions.setVisibility("practice", id, "friends"),
    ],
    ["a bad kind", () => actions.setVisibility("progress", id, "public")],
    ["a bad collection", () => actions.movePractice(id, "nope")],
  ])("rejects %s without writing", async (_, run) => {
    expect(await run()).toEqual({ ok: false, reason: "invalid" });
    expect(state.calls).toEqual([]);
  });

  it("reports another user's (or a missing) row as not found", async () => {
    state.rows = [];
    expect(await actions.deletePractice(id)).toEqual({
      ok: false,
      reason: "not-found",
    });
  });

  it("reports database errors", async () => {
    state.error = { message: "down" };
    expect(await actions.renameCollection(id, "New")).toEqual({
      ok: false,
      reason: "failed",
    });
  });

  it("is unavailable to non-admins", async () => {
    state.admin = false;
    expect(await actions.createCollection("Week 1")).toEqual({
      ok: false,
      reason: "unavailable",
    });
    expect(state.calls).toEqual([]);
  });
});
