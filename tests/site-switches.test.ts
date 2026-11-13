import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  activeAnnouncements,
  DEFAULT_SWITCHES,
  openInMaintenance,
  parseAnnouncement,
  parseSwitches,
  pausedFeatures,
  pauseReason,
  siteState,
  SWITCHABLE_FEATURES,
} from "@/lib/site-switches";

/** Emergency switches (D155): the pure rules. */
describe("site switches (D155)", () => {
  it("treats a missing or broken row as everything on", () => {
    expect(parseSwitches(null)).toEqual(DEFAULT_SWITCHES);
    expect(parseSwitches({ features: "nope" })).toEqual(DEFAULT_SWITCHES);
    expect(siteState(DEFAULT_SWITCHES)).toBe("normal");
    expect(pausedFeatures(DEFAULT_SWITCHES)).toEqual([]);
  });

  it("reads the row's columns", () => {
    const switches = parseSwitches({
      maintenance: false,
      read_only: false,
      features: { aiGenerate: false, publicShare: true, unknown: false },
    });
    expect(switches.features.aiGenerate).toBe(false);
    expect(switches.features.publicShare).toBe(true);
    expect(pauseReason(switches, "aiGenerate")).toBe("off");
    expect(pauseReason(switches, "aiRevise")).toBeNull();
    expect(pauseReason(switches, "create")).toBeNull();
    expect(siteState(switches)).toBe("partial");
  });

  it("read-only pauses creating and every risky feature", () => {
    const switches = parseSwitches({ read_only: true });
    expect(siteState(switches)).toBe("readOnly");
    expect(pauseReason(switches, "create")).toBe("readOnly");
    expect(pausedFeatures(switches)).toEqual([...SWITCHABLE_FEATURES]);
  });

  it("maintenance wins over everything", () => {
    const switches = parseSwitches({ maintenance: true, read_only: true });
    expect(siteState(switches)).toBe("maintenance");
    expect(pauseReason(switches, "signup")).toBe("maintenance");
  });

  it("keeps sign-in, status, health checks, and legal pages open in maintenance", () => {
    for (const path of [
      "/maintenance",
      "/status",
      "/login",
      "/auth/callback",
      "/api/health",
      "/api/cron/monitor",
      "/privacy",
    ]) {
      expect(openInMaintenance(path), path).toBe(true);
    }
    for (const path of ["/", "/materials", "/admin", "/statusx", "/loginx"]) {
      expect(openInMaintenance(path), path).toBe(false);
    }
  });

  it("shows announcements between their start and end, newest first", () => {
    const rows = [
      {
        id: "a",
        level: "info",
        body_zh: "舊",
        body_en: "old",
        starts_at: "2026-11-01T00:00:00Z",
        ends_at: null,
      },
      {
        id: "b",
        level: "critical",
        body_zh: "新",
        body_en: "new",
        starts_at: "2026-11-10T00:00:00Z",
        ends_at: null,
      },
      {
        id: "c",
        level: "warning",
        body_zh: "過期",
        body_en: "ended",
        starts_at: "2026-11-01T00:00:00Z",
        ends_at: "2026-11-05T00:00:00Z",
      },
      { id: "d", level: "loud", body_zh: "x", body_en: "x", starts_at: "x" },
    ];
    const parsed = rows.flatMap((row) => parseAnnouncement(row) ?? []);
    expect(parsed.map((a) => a.id)).toEqual(["a", "b", "c"]);
    expect(
      activeAnnouncements(parsed, new Date("2026-11-12T00:00:00Z")).map(
        (a) => a.id,
      ),
    ).toEqual(["b", "a"]);
  });
});

describe("reading the switches (D155)", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public-key");
    vi.stubEnv("SITE_SWITCHES_TTL_MS", "60000");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("reads once, then from memory; admins are never paused", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([{ read_only: true, features: {} }]), {
        status: 200,
      }),
    );
    const { featurePaused, getSiteSwitches } =
      await import("@/auth/site-switches");
    expect((await getSiteSwitches()).readOnly).toBe(true);
    await getSiteSwitches();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/rest/v1/site_settings",
    );
    expect(await featurePaused({ role: "user" }, "create")).toBe("readOnly");
    expect(await featurePaused({ role: "admin" }, "create")).toBeNull();
    expect(await featurePaused(null, "signup")).toBe("readOnly");
  });

  it("keeps the site on when the row can't be read", async () => {
    fetchMock.mockRejectedValue(new Error("down"));
    const { getSiteSwitches } = await import("@/auth/site-switches");
    expect(await getSiteSwitches()).toEqual(DEFAULT_SWITCHES);
  });
});
