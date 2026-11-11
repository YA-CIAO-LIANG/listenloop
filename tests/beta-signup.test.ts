import { beforeEach, describe, expect, it, vi } from "vitest";

/** Email sign-ups when the Beta is full (D132). */
const state = vi.hoisted(() => ({
  full: false,
  invite: null as string | null,
  signUp: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "listenloop.test" }),
}));
vi.mock("@/auth/rate-limit", () => ({ allowAction: async () => true }));
vi.mock("@/auth/events", () => ({ logEvent: vi.fn() }));
vi.mock("@/auth/beta", () => ({
  getBetaStatus: async () => ({
    open: true,
    cap: 50,
    admitted: state.full ? 50 : 3,
    full: state.full,
  }),
  inviteFromCookie: async () => state.invite,
}));
vi.mock("@/auth/server", () => ({
  getServerSupabase: async () => ({ auth: { signUp: state.signUp } }),
}));

const { signUpWithEmail } = await import("@/app/login/actions");

const form = () => {
  const data = new FormData();
  data.set("email", "new@example.com");
  data.set("password", "correct horse battery");
  return data;
};

beforeEach(() => {
  state.full = false;
  state.invite = null;
  state.signUp.mockReset().mockResolvedValue({ error: null });
});

describe("signUpWithEmail and the Beta (D132)", () => {
  it("sends the confirmation while there's room", async () => {
    expect(await signUpWithEmail(form())).toEqual({ ok: true, sent: true });
    expect(state.signUp).toHaveBeenCalled();
  });

  it("says the Beta is full before any email goes out", async () => {
    state.full = true;
    expect(await signUpWithEmail(form())).toEqual({
      ok: false,
      reason: "full",
    });
    expect(state.signUp).not.toHaveBeenCalled();
  });

  it("lets someone with an invite sign up anyway", async () => {
    state.full = true;
    state.invite = "ABCD2345";
    expect(await signUpWithEmail(form())).toEqual({ ok: true, sent: true });
  });
});
