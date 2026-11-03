import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: null as { id: string; email: string } | null,
  hasAdminClient: true,
  rpc: vi.fn(),
}));
vi.mock("@/auth/session", () => ({ getSignedInUser: async () => state.user }));
vi.mock("@/auth/admin", () => ({
  getAdminSupabase: () => (state.hasAdminClient ? { rpc: state.rpc } : null),
}));

const { getCreator, supabaseUsageMeter } = await import("@/auth/creator");

beforeEach(() => {
  state.user = { id: "user-1", email: "Joe@Example.com" };
  state.hasAdminClient = true;
  state.rpc.mockReset().mockResolvedValue({ data: true, error: null });
  vi.stubEnv("AI_PROVIDERS", "fake");
  vi.stubEnv("ADMIN_EMAILS", "joe@example.com");
  vi.stubEnv("VERCEL_ENV", "");
});

describe("getCreator", () => {
  it("lets a signed-in admin create practices", async () => {
    const creator = await getCreator();
    expect(creator?.user.id).toBe("user-1");
  });

  it.each([
    ["signed out", () => (state.user = null)],
    ["not an admin", () => vi.stubEnv("ADMIN_EMAILS", "someone@else.com")],
    ["no provider", () => vi.stubEnv("AI_PROVIDERS", "")],
    ["no secret key", () => (state.hasAdminClient = false)],
  ])("is unavailable when %s", async (_, arrange) => {
    arrange();
    expect(await getCreator()).toBeNull();
  });
});

describe("supabaseUsageMeter", () => {
  it("reserves against today's Taiwan-time limit", async () => {
    const meter = supabaseUsageMeter(
      { rpc: state.rpc } as never,
      "user-1",
      () => new Date("2026-11-03T16:30:00Z"),
    );
    expect(await meter.reserve("speech", 120)).toBe(true);
    expect(state.rpc).toHaveBeenCalledWith("reserve_api_usage", {
      target_user: "user-1",
      usage_kind: "speech",
      usage_day: "2026-11-04",
      amount: 120,
      max_chars: 20_000,
    });
  });

  it("reports the limit, and throws on database errors", async () => {
    const meter = supabaseUsageMeter({ rpc: state.rpc } as never, "user-1");
    state.rpc.mockResolvedValue({ data: false, error: null });
    expect(await meter.reserve("translation", 1)).toBe(false);
    state.rpc.mockResolvedValue({ data: null, error: { message: "down" } });
    await expect(meter.reserve("translation", 1)).rejects.toThrow("down");
  });
});
