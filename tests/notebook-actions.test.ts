import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanNote } from "@/lib/custom-practice/organize";

type Call = {
  table: string;
  op: string;
  values?: unknown;
  eq?: [string, unknown];
};
const state = vi.hoisted(() => ({
  admin: true,
  calls: [] as Call[],
  rows: [{ id: "x" }] as unknown[],
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
      const done = { select: async () => ({ data: state.rows, error: null }) };
      const filtered = {
        eq: (column: string, value: unknown) => (
          (call.eq = [column, value]),
          done
        ),
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

const actions = await import("@/app/notebooks/actions");
const id = "0b1d2c3e-4f50-4a6b-8c7d-9e0f1a2b3c4d";

beforeEach(() => {
  state.admin = true;
  state.calls = [];
  state.rows = [{ id: "x" }];
});

describe("cleanNote", () => {
  it("allows empty notes and keeps line breaks", () => {
    expect(cleanNote(undefined, 10)).toBe("");
    expect(cleanNote("  a  b\nc ", 10)).toBe("a b\nc");
    expect(cleanNote("x".repeat(11), 10)).toBeNull();
    expect(cleanNote(5, 10)).toBeNull();
  });
});

describe("notebook actions", () => {
  it("creates, renames, and deletes notebooks", async () => {
    await actions.createNotebook(" Words ");
    await actions.renameNotebook(id, "Phrases");
    await actions.deleteNotebook(id);
    expect(state.calls).toEqual([
      {
        table: "notebooks",
        op: "insert",
        values: { user_id: "user-1", title: "Words" },
      },
      {
        table: "notebooks",
        op: "update",
        values: { title: "Phrases" },
        eq: ["id", id],
      },
      { table: "notebooks", op: "delete", eq: ["id", id] },
    ]);
  });

  it("adds and deletes entries", async () => {
    expect(await actions.addEntry(id, " move to ", " 搬到 ")).toEqual({
      ok: true,
    });
    await actions.deleteEntry(id);
    expect(state.calls).toEqual([
      {
        table: "notebook_entries",
        op: "insert",
        values: {
          notebook_id: id,
          user_id: "user-1",
          text: "move to",
          note: "搬到",
        },
      },
      { table: "notebook_entries", op: "delete", eq: ["id", id] },
    ]);
  });

  it.each([
    ["an empty notebook name", () => actions.createNotebook("")],
    ["an empty entry", () => actions.addEntry(id, "  ", "")],
    ["a long note", () => actions.addEntry(id, "word", "x".repeat(2001))],
    ["a bad notebook id", () => actions.addEntry("nope", "word", "")],
    ["a bad entry id", () => actions.deleteEntry("nope")],
  ])("rejects %s without writing", async (_, run) => {
    expect(await run()).toEqual({ ok: false, reason: "invalid" });
    expect(state.calls).toEqual([]);
  });

  it("reports someone else's notebook as not found", async () => {
    state.rows = [];
    expect(await actions.addEntry(id, "word", "")).toEqual({
      ok: false,
      reason: "not-found",
    });
  });

  it("is unavailable to non-admins", async () => {
    state.admin = false;
    expect(await actions.createNotebook("Words")).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });
});
