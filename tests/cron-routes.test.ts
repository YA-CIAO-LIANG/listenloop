import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** The monitor's routes (D156): closed without the secret, no details out. */
const state = vi.hoisted(() => ({
  runMonitor: vi.fn(async () => ({ status: "ok", alerts: 0, sent: 0 })),
  runMonitorIfDue: vi.fn(async () => true),
  after: [] as (() => unknown)[],
  health: {
    db: "ok",
    storage: "ok",
    ai: "skipped",
    speech: "skipped",
    config: "ok",
  },
}));

vi.mock("@/auth/admin", () => ({ getAdminSupabase: () => ({}) }));
vi.mock("@/auth/ops", () => ({
  runMonitor: state.runMonitor,
  runHealthChecks: async () => state.health,
  runMonitorIfDue: state.runMonitorIfDue,
}));
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: (task: () => unknown) => {
    state.after.push(task);
  },
}));

const SECRET = "c".repeat(40);

beforeEach(() => {
  state.runMonitor.mockClear();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("/api/cron/monitor (D156)", () => {
  it("doesn't exist without CRON_SECRET", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const { POST } = await import("@/app/api/cron/monitor/route");
    const response = await POST(
      new Request("http://x/api/cron/monitor", { method: "POST" }),
    );
    expect(response.status).toBe(404);
    expect(state.runMonitor).not.toHaveBeenCalled();
  });

  it("refuses a wrong secret and runs with the right one", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    const { POST } = await import("@/app/api/cron/monitor/route");
    const wrong = await POST(
      new Request("http://x/api/cron/monitor", {
        method: "POST",
        headers: { authorization: "Bearer nope" },
      }),
    );
    expect(wrong.status).toBe(401);
    const right = await POST(
      new Request("http://x/api/cron/monitor?daily=1", {
        method: "POST",
        headers: { authorization: `Bearer ${SECRET}` },
      }),
    );
    expect(right.status).toBe(200);
    expect(state.runMonitor).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Date),
      { daily: true },
    );
  });
});

describe("/api/health (D156)", () => {
  it("answers the state and ok/fail per part, nothing more", async () => {
    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      status: "ok",
      checks: state.health,
    });
  });

  it("starts the monitor after answering, which decides if it's due (D163)", async () => {
    state.after.length = 0;
    state.runMonitorIfDue.mockClear();
    const { GET } = await import("@/app/api/health/route");
    await GET();
    expect(state.runMonitorIfDue).not.toHaveBeenCalled();
    expect(state.after).toHaveLength(1);
    await state.after[0]();
    expect(state.runMonitorIfDue).toHaveBeenCalledWith(expect.any(Date));
  });
});
