import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SignedInUser } from "@/auth/session";

const state = vi.hoisted(() => ({
  user: null as SignedInUser | null,
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
  state.user = {
    id: "user-1",
    email: "joe@example.com",
    number: 0,
    role: "admin",
    plan: "free",
    practicesCreated: 0,
    classroomSeats: null,
  };
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

  it("lets a regular account create too: the plan counts them (D72)", async () => {
    state.user = {
      ...state.user!,
      role: "user",
      practicesCreated: 5,
      classroomSeats: null,
    };
    expect((await getCreator())?.user.id).toBe("user-1");
  });

  it.each([
    ["signed out", () => (state.user = null)],
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
      max_micros: 50_000,
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
      error: "config",
      httpStatus: 404,
      errorCode: "DeploymentNotFound",
      inputTokens: 10,
      outputTokens: 20,
      chars: 5,
      costMicros: 3,
    });
    expect(insert).toHaveBeenCalledWith({
      user_id: "user-1",
      provider: "fake",
      operation: "translate",
      error: "config",
      http_status: 404,
      error_code: "DeploymentNotFound",
      outcome: null,
      input_tokens: 10,
      output_tokens: 20,
      chars: 5,
      cost_micros: 3,
    });
  });

  it("keeps batch jobs on their own allowance (D77)", async () => {
    const meter = supabaseUsageMeter(
      admin(),
      "admin-1",
      () => new Date("2026-11-04T01:00:00Z"),
      { limits: { speech: 1, cost: 1_000_000 }, bucket: "batch" },
    );
    await meter.reserve("cost", 900);
    expect(state.rpc).toHaveBeenCalledWith("reserve_api_batch_cost", {
      target_user: "admin-1",
      usage_day: "2026-11-04",
      amount: 900,
      max_micros: 1_000_000,
    });
    await meter.settle(-100);
    expect(state.rpc).toHaveBeenLastCalledWith("settle_api_batch_cost", {
      target_user: "admin-1",
      usage_day: "2026-11-04",
      delta: -100,
    });
  });

  it("names the allowance that ran out and when it resets (D77)", async () => {
    const now = () => new Date("2026-11-04T01:00:00Z");
    state.rpc.mockResolvedValue({ data: false, error: null });
    const daily = supabaseUsageMeter(admin(), "user-1", now);
    expect(await daily.reserve("cost", 1)).toBe(false);
    // Taiwan midnight after 2026-11-04 09:00 local.
    expect(daily.lastBlock?.()).toEqual({
      kind: "daily",
      resetsAt: "2026-11-04T16:00:00.000Z",
    });
    expect(await daily.reserve("speech", 1)).toBe(false);
    expect(daily.lastBlock?.()?.kind).toBe("speech");
  });

  it("stops everyone but admins at the site's monthly cap (D77)", async () => {
    const now = () => new Date("2026-11-20T01:00:00Z");
    state.rpc.mockImplementation(async (name: string) =>
      name === "month_api_cost"
        ? { data: 7_999_500, error: null }
        : { data: true, error: null },
    );
    const capped = supabaseUsageMeter(admin(), "user-1", now, {
      monthlyMicros: 8_000_000,
    });
    expect(await capped.reserve("cost", 400)).toBe(true);
    expect(await capped.reserve("cost", 600)).toBe(false);
    expect(capped.lastBlock?.()).toEqual({
      kind: "monthly",
      resetsAt: "2026-11-30T16:00:00.000Z",
    });
    expect(state.rpc).toHaveBeenCalledWith("month_api_cost", {
      month_start: "2026-10-31T16:00:00.000Z",
    });
    const uncapped = supabaseUsageMeter(admin(), "admin-1", now);
    expect(await uncapped.reserve("cost", 600)).toBe(true);
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
        httpStatus: null,
        errorCode: null,
        inputTokens: 0,
        outputTokens: 0,
        chars: 1,
        costMicros: 0,
      }),
    ).rejects.toThrow("full");
  });
});
