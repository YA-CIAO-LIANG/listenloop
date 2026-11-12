import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanInviteCode,
  cleanInviteOptions,
  cleanSignupSettings,
  cleanWaitlistEntry,
  inviteState,
  isAdmitted,
  newInviteCode,
} from "@/lib/beta";

const state = vi.hoisted(() => ({
  cookie: undefined as string | undefined,
  deletedCookies: [] as string[],
  answer: "open" as string,
  rpc: vi.fn(),
  deleteUser: vi.fn(),
  signOut: vi.fn(),
  upserts: [] as unknown[],
  allowed: true,
  admin: true,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (state.cookie ? { value: state.cookie } : undefined),
    delete: (name: string) => state.deletedCookies.push(name),
  }),
}));
vi.mock("@/auth/rate-limit", () => ({
  allowAction: async () => state.allowed,
}));
vi.mock("@/auth/server", () => ({
  getServerSupabase: async () => ({ auth: { signOut: state.signOut } }),
}));
vi.mock("@/auth/admin", () => ({
  getAdminSupabase: () =>
    state.admin
      ? {
          rpc: state.rpc,
          auth: { admin: { deleteUser: state.deleteUser } },
          from: () => ({
            upsert: async (row: unknown) => {
              state.upserts.push(row);
              return { error: null };
            },
          }),
        }
      : null,
}));

const { admitAfterSignIn } = await import("@/auth/beta");
const { joinBetaWaitlist } = await import("@/app/beta/actions");

beforeEach(() => {
  state.cookie = undefined;
  state.deletedCookies = [];
  state.answer = "open";
  state.rpc.mockReset().mockImplementation(async () => ({
    data: state.answer,
    error: null,
  }));
  state.deleteUser.mockReset().mockResolvedValue({ error: null });
  state.signOut.mockReset().mockResolvedValue({ error: null });
  state.upserts = [];
  state.allowed = true;
  state.admin = true;
  vi.stubEnv("ADMIN_EMAILS", "owner@example.com");
});

describe("invite codes (D132)", () => {
  it("are 8 characters without look-alikes", () => {
    for (let i = 0; i < 50; i++) {
      const code = newInviteCode();
      expect(code).toMatch(/^[A-HJ-KM-NP-Z2-9]{8}$/);
      expect(code).not.toMatch(/[01ILO]/);
    }
    expect(cleanInviteCode(" ab3defgh ")).toBe("AB3DEFGH");
    expect(cleanInviteCode("short")).toBeNull();
    expect(cleanInviteCode(42)).toBeNull();
  });

  it("know when they can't be used", () => {
    const now = new Date("2026-11-11T00:00:00Z");
    const invite = { max_uses: 2, uses: 1, expires_at: null, revoked_at: null };
    expect(inviteState(invite, now)).toBe("active");
    expect(inviteState({ ...invite, uses: 2 }, now)).toBe("used-up");
    expect(
      inviteState({ ...invite, expires_at: "2026-11-10T00:00:00Z" }, now),
    ).toBe("expired");
    expect(
      inviteState({ ...invite, revoked_at: "2026-11-01T00:00:00Z" }, now),
    ).toBe("revoked");
  });

  it("check the admin's forms", () => {
    expect(cleanSignupSettings({ open: true, cap: 50 })).toEqual({
      open: true,
      cap: 50,
    });
    expect(cleanSignupSettings({ open: "yes", cap: 50 })).toBeNull();
    expect(cleanSignupSettings({ open: false, cap: -1 })).toBeNull();
    expect(cleanSignupSettings({ open: false, cap: 1.5 })).toBeNull();
    expect(cleanInviteOptions({ maxUses: 5, days: "", note: " x " })).toEqual({
      maxUses: 5,
      days: null,
      note: "x",
    });
    expect(cleanInviteOptions({ maxUses: 0, days: 3, note: "" })).toBeNull();
    expect(cleanInviteOptions({ maxUses: 1, days: 400, note: "" })).toBeNull();
    expect(
      cleanWaitlistEntry({ email: " A@B.co ", purpose: "  TOEIC   prep " }),
    ).toEqual({ email: "a@b.co", purpose: "TOEIC prep" });
    expect(cleanWaitlistEntry({ email: "nope", purpose: "" })).toBeNull();
    expect(
      cleanWaitlistEntry({ email: "a@b.co", purpose: "x".repeat(501) }),
    ).toBeNull();
    expect(isAdmitted("invite")).toBe(true);
    expect(isAdmitted("full")).toBe(false);
  });
});

describe("admitAfterSignIn (D132)", () => {
  it("lets a new account in while there's room", async () => {
    expect(await admitAfterSignIn({ id: "u1", email: "a@b.co" })).toBe("ok");
    expect(state.rpc).toHaveBeenCalledWith("admit_account", {
      target: "u1",
      invite_code: "",
      as_admin: false,
    });
    expect(state.deleteUser).not.toHaveBeenCalled();
  });

  it("uses this browser's invite, then forgets it", async () => {
    state.cookie = "abcd2345";
    state.answer = "invite";
    expect(await admitAfterSignIn({ id: "u1", email: "a@b.co" })).toBe("ok");
    expect(state.rpc).toHaveBeenCalledWith("admit_account", {
      target: "u1",
      invite_code: "ABCD2345",
      as_admin: false,
    });
    expect(state.deletedCookies).toEqual(["ll-invite"]);
  });

  it("always lets admins in", async () => {
    state.answer = "admin";
    await admitAfterSignIn({ id: "u0", email: "Owner@example.com" });
    expect(state.rpc).toHaveBeenCalledWith(
      "admit_account",
      expect.objectContaining({ as_admin: true }),
    );
  });

  it("removes the account just made when the Beta is full or closed", async () => {
    state.answer = "full";
    expect(await admitAfterSignIn({ id: "u9", email: "n@b.co" })).toBe("full");
    expect(state.signOut).toHaveBeenCalled();
    expect(state.deleteUser).toHaveBeenCalledWith("u9");
    state.answer = "closed";
    expect(await admitAfterSignIn({ id: "u9", email: "n@b.co" })).toBe(
      "closed",
    );
  });

  it("never removes an account already in, nor on a database problem", async () => {
    state.answer = "admitted";
    expect(await admitAfterSignIn({ id: "u1" })).toBe("ok");
    state.rpc.mockResolvedValue({ data: null, error: { message: "down" } });
    expect(await admitAfterSignIn({ id: "u1" })).toBe("ok");
    expect(state.deleteUser).not.toHaveBeenCalled();
  });

  it("has no gate without the secret key (local, E2E)", async () => {
    state.admin = false;
    expect(await admitAfterSignIn({ id: "u1" })).toBe("ok");
  });
});

describe("joinBetaWaitlist (D132)", () => {
  it("keeps the email and what it's for, once per email", async () => {
    expect(
      await joinBetaWaitlist({ email: "A@B.co", purpose: "TOEIC" }),
    ).toEqual({ ok: true });
    expect(state.upserts).toEqual([{ email: "a@b.co", purpose: "TOEIC" }]);
  });

  it("refuses a bad email, and too many tries", async () => {
    expect(await joinBetaWaitlist({ email: "x", purpose: "" })).toEqual({
      ok: false,
      reason: "invalid",
    });
    state.allowed = false;
    expect(await joinBetaWaitlist({ email: "a@b.co", purpose: "" })).toEqual({
      ok: false,
      reason: "busy",
    });
    expect(state.upserts).toEqual([]);
  });
});
