import { beforeEach, describe, expect, it, vi } from "vitest";

/** The admin's sign-up controls (D132). */
const WAITING = "11111111-1111-4111-8111-111111111111";
const state = vi.hoisted(() => ({
  admin: true,
  calls: [] as [string, string, unknown][],
  audit: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/auth/audit", () => ({ logAudit: state.audit }));
vi.mock("@/auth/creator", () => ({
  getAdminUser: async () => (state.admin ? { id: "admin-1" } : null),
}));
vi.mock("@/auth/admin", () => ({
  getAdminSupabase: () => ({
    from: (table: string) => {
      const chain = {
        update: (row: unknown) => {
          state.calls.push([table, "update", row]);
          return chain;
        },
        insert: (row: unknown) => {
          state.calls.push([table, "insert", row]);
          return chain;
        },
        select: () => chain,
        eq: () => chain,
        is: () => chain,
        in: async () => ({
          data: [{ id: WAITING, email: "wait@example.com" }],
          error: null,
        }),
        single: async () => ({
          data: { id: "inv-1", code: "ABCD2345" },
          error: null,
        }),
        then: (resolve: (value: unknown) => void) =>
          resolve({ data: [{ code: "ABCD2345" }], error: null }),
      };
      return chain;
    },
  }),
}));

const { createInvite, inviteFromWaitlist, saveSignupSettings } =
  await import("@/app/admin/beta/actions");

beforeEach(() => {
  state.admin = true;
  state.calls = [];
  state.audit.mockReset();
});

describe("admin sign-up controls (D132)", () => {
  it("saves the switch and the cap, and audits it", async () => {
    expect(await saveSignupSettings({ open: false, cap: 80 })).toEqual({
      ok: true,
    });
    expect(state.calls[0]).toEqual([
      "signup_settings",
      "update",
      expect.objectContaining({ open: false, cap: 80, updated_by: "admin-1" }),
    ]);
    expect(state.audit).toHaveBeenCalledWith(
      "admin-1",
      "signup_settings",
      { type: "setting", id: "signup" },
      { open: false, cap: 80 },
    );
    expect(await saveSignupSettings({ open: true, cap: -5 })).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("makes an invite with uses and an expiry", async () => {
    const result = await createInvite({ maxUses: 10, days: 7, note: "班級" });
    expect(result).toMatchObject({ ok: true, code: "ABCD2345" });
    expect(result.ok && result.url).toMatch(/\/invite\/ABCD2345$/);
    expect(state.calls[0]).toEqual([
      "beta_invites",
      "insert",
      expect.objectContaining({ max_uses: 10, note: "班級" }),
    ]);
  });

  it("invites the waiting list one link each, and marks them", async () => {
    const result = await inviteFromWaitlist([WAITING]);
    expect(result).toEqual({
      ok: true,
      invites: [
        {
          email: "wait@example.com",
          url: expect.stringMatching(/\/invite\/ABCD2345$/),
        },
      ],
    });
    expect(state.calls).toEqual([
      ["beta_invites", "insert", expect.objectContaining({ max_uses: 1 })],
      [
        "beta_waitlist",
        "update",
        expect.objectContaining({ invite_id: "inv-1" }),
      ],
    ]);
    // The audit log has the count, never the emails.
    expect(state.audit).toHaveBeenCalledWith(
      "admin-1",
      "waitlist_invite",
      { type: "setting", id: "waitlist" },
      { count: 1 },
    );
  });

  it("is for admins only", async () => {
    state.admin = false;
    expect(await saveSignupSettings({ open: true, cap: 1 })).toEqual({
      ok: false,
      reason: "unavailable",
    });
    expect(await inviteFromWaitlist([WAITING])).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });
});
