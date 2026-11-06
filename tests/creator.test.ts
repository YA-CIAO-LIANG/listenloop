import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: null as { id: string; email: string } | null,
  hasAdminClient: true,
  rpc: vi.fn(),
}));
vi.mock("@/auth/session", () => ({ getSignedInUser: async () => state.user }));
vi.mock("@/auth/admin", () => ({
  getAdminSupabase: () => (state.hasAdminClient ? { rpc: state.rpc } : null),
  hasAdminSupabase: () => state.hasAdminClient,
}));

const { diagnoseCreator, getCreator, supabaseUsageMeter } =
  await import("@/auth/creator");

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

describe("diagnoseCreator (D47)", () => {
  it("is ready when getCreator would be", () => {
    expect(diagnoseCreator(state.user).ready).toBe(true);
  });

  it("names the missing secret key", () => {
    state.hasAdminClient = false;
    const { ready, groups } = diagnoseCreator(state.user);
    expect(ready).toBe(false);
    const checks = groups.flatMap((g) => g.checks);
    expect(checks.find((c) => c.id === "serviceKey")?.ok).toBe(false);
    // The fakes are on, so the vendors' keys aren't listed.
    expect(groups[1]).toEqual({
      id: "language",
      vendor: "fake",
      checks: [{ id: "fakeInUse", ok: true }],
    });
  });

  it("names fake providers on the production site", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const { ready, groups } = diagnoseCreator(state.user);
    expect(ready).toBe(false);
    expect(groups[0].checks.find((c) => c.id === "notFake")?.ok).toBe(false);
  });
});

describe("supabaseUsageMeter", () => {
  const insert = vi.fn();
  const admin = () =>
    ({ rpc: state.rpc, from: vi.fn(() => ({ insert })) }) as never;
  beforeEach(() => insert.mockReset().mockResolvedValue({ error: null }));

  it("reserves speech characters against today's Taiwan-time limit", async () => {
    const meter = supabaseUsageMeter(
      admin(),
      "user-1",
      () => new Date("2026-11-03T16:30:00Z"),
    );
    expect(await meter.reserve("speech", 120)).toBe(true);
    expect(state.rpc).toHaveBeenCalledWith("reserve_api_usage", {
      target_user: "user-1",
      usage_kind: "speech",
      usage_day: "2026-11-04",
      amount: 120,
      max_chars: 16_000,
    });
  });

  it("reserves and settles cost on the day it was made", async () => {
    let now = new Date("2026-11-04T15:59:00Z");
    const meter = supabaseUsageMeter(admin(), "user-1", () => now);
    expect(await meter.reserve("cost", 900)).toBe(true);
    expect(state.rpc).toHaveBeenCalledWith("reserve_api_cost", {
      target_user: "user-1",
      usage_day: "2026-11-04",
      amount: 900,
      max_micros: 500_000,
    });
    // Past midnight in Taiwan, the call still settles on its own day.
    now = new Date("2026-11-04T16:01:00Z");
    await meter.settle(-400);
    expect(state.rpc).toHaveBeenLastCalledWith("settle_api_cost", {
      target_user: "user-1",
      usage_day: "2026-11-04",
      delta: -400,
    });
  });

  it("logs each call's counts", async () => {
    const meter = supabaseUsageMeter(admin(), "user-1");
    await meter.log({
      provider: "fake",
      operation: "translate",
      error: null,
      inputTokens: 10,
      outputTokens: 20,
      chars: 5,
      costMicros: 3,
    });
    expect(insert).toHaveBeenCalledWith({
      user_id: "user-1",
      provider: "fake",
      operation: "translate",
      error: null,
      input_tokens: 10,
      output_tokens: 20,
      chars: 5,
      cost_micros: 3,
    });
  });

  it("reports the limit, and throws on database errors", async () => {
    const meter = supabaseUsageMeter(admin(), "user-1");
    state.rpc.mockResolvedValue({ data: false, error: null });
    expect(await meter.reserve("cost", 1)).toBe(false);
    state.rpc.mockResolvedValue({ data: null, error: { message: "down" } });
    await expect(meter.reserve("cost", 1)).rejects.toThrow("down");
    await expect(meter.settle(1)).rejects.toThrow("down");
    insert.mockResolvedValue({ error: { message: "full" } });
    await expect(
      meter.log({
        provider: "fake",
        operation: "speech",
        error: null,
        inputTokens: 0,
        outputTokens: 0,
        chars: 1,
        costMicros: 0,
      }),
    ).rejects.toThrow("full");
  });
});
