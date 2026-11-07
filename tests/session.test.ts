import { beforeEach, describe, expect, it, vi } from "vitest";

/** getSignedInUser (D50): roles, numbers, disabled accounts. */
const state = vi.hoisted(() => ({
  claims: null as { sub: string; email: string } | null,
  profile: null as { number: number; role: string; status: string } | null,
  upsert: vi.fn(),
}));

vi.mock("@/auth/server", () => ({
  getServerSupabase: async () => ({
    auth: {
      getClaims: async () => ({
        data: state.claims && { claims: state.claims },
        error: null,
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: state.profile, error: null }),
        }),
      }),
    }),
  }),
}));
vi.mock("@/auth/admin", () => ({
  getAdminSupabase: () => ({ from: () => ({ upsert: state.upsert }) }),
}));

const { getSignedInUser } = await import("@/auth/session");

beforeEach(() => {
  state.claims = { sub: "u1", email: "learner@example.com" };
  state.profile = { number: 1, role: "user", status: "active" };
  state.upsert.mockReset().mockResolvedValue({ error: null });
  vi.stubEnv("ADMIN_EMAILS", "owner@example.com");
});

describe("getSignedInUser", () => {
  it("is null when signed out", async () => {
    state.claims = null;
    expect(await getSignedInUser()).toBeNull();
  });

  it("carries the number and role from the profile", async () => {
    expect(await getSignedInUser()).toEqual({
      id: "u1",
      email: "learner@example.com",
      number: 1,
      role: "user",
    });
    expect(state.upsert).not.toHaveBeenCalled();
  });

  it("treats a disabled account as signed out", async () => {
    state.profile = { number: 1, role: "admin", status: "disabled" };
    expect(await getSignedInUser()).toBeNull();
  });

  it("makes an account in ADMIN_EMAILS an admin, and saves it", async () => {
    state.claims = { sub: "u0", email: "Owner@Example.com" };
    state.profile = { number: 0, role: "user", status: "active" };
    expect(await getSignedInUser()).toMatchObject({ role: "admin" });
    expect(state.upsert).toHaveBeenCalledWith(
      { user_id: "u0", role: "admin" },
      { onConflict: "user_id" },
    );
  });

  it("keeps an admin made on the admin pages", async () => {
    state.profile = { number: 4, role: "admin", status: "active" };
    expect(await getSignedInUser()).toMatchObject({ role: "admin" });
  });
});
