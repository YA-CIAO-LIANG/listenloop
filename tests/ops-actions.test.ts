import { beforeEach, describe, expect, it, vi } from "vitest";

/** The admin's emergency switches and announcements (D155). */
const state = vi.hoisted(() => ({
  admin: true,
  calls: [] as [string, string, unknown][],
  audit: vi.fn(),
  cleared: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/auth/audit", () => ({ logAudit: state.audit }));
vi.mock("@/auth/site-switches", () => ({
  clearSiteSwitchCache: state.cleared,
}));
vi.mock("@/auth/creator", () => ({
  getAdminUser: async () =>
    state.admin
      ? { id: "admin-1", signedInAt: Math.floor(Date.now() / 1000) }
      : null,
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
        single: async () => ({ data: { id: "ann-1" }, error: null }),
        then: (resolve: (value: unknown) => void) =>
          resolve({ data: null, error: null }),
      };
      return chain;
    },
  }),
}));

const { endSiteAnnouncement, postSiteAnnouncement, saveSiteSwitches } =
  await import("@/app/admin/ops/actions");

const allOn = {
  aiGenerate: true,
  aiRevise: true,
  uploadAudio: true,
  transcribe: true,
  publicShare: true,
  signup: true,
};

beforeEach(() => {
  state.admin = true;
  state.calls = [];
  state.audit.mockReset();
  state.cleared.mockReset();
});

describe("emergency switches (D155)", () => {
  it("saves every switch, audits it, and drops the cached copy", async () => {
    expect(
      await saveSiteSwitches({
        maintenance: false,
        readOnly: true,
        features: { ...allOn, aiGenerate: false },
      }),
    ).toEqual({ ok: true });
    const [table, , row] = state.calls[0];
    expect(table).toBe("site_settings");
    expect(row).toMatchObject({
      maintenance: false,
      read_only: true,
      features: { ...allOn, aiGenerate: false },
      updated_by: "admin-1",
    });
    expect(state.audit).toHaveBeenCalledWith(
      "admin-1",
      "site_switches",
      { type: "setting", id: "site" },
      expect.objectContaining({ readOnly: true }),
    );
    expect(state.cleared).toHaveBeenCalled();
  });

  it("refuses non-admins and incomplete input", async () => {
    state.admin = false;
    expect(
      await saveSiteSwitches({
        maintenance: true,
        readOnly: false,
        features: allOn,
      }),
    ).toEqual({ ok: false, reason: "unavailable" });
    state.admin = true;
    expect(
      await saveSiteSwitches({ maintenance: true, readOnly: false }),
    ).toEqual({ ok: false, reason: "invalid" });
    expect(state.calls).toEqual([]);
  });

  it("posts an announcement with an end time, and ends one", async () => {
    expect(
      await postSiteAnnouncement({
        level: "warning",
        bodyZh: "  維護  ",
        bodyEn: "Maintenance",
        hours: 2,
      }),
    ).toEqual({ ok: true });
    const row = state.calls[0][2] as Record<string, string>;
    expect(row).toMatchObject({ level: "warning", body_zh: "維護" });
    expect(Date.parse(row.ends_at) - Date.parse(row.starts_at)).toBe(
      2 * 3_600_000,
    );
    expect(
      await endSiteAnnouncement("11111111-1111-4111-8111-111111111111"),
    ).toEqual({ ok: true });
    expect(state.audit).toHaveBeenCalledTimes(2);
  });

  it("refuses an empty, too long, or badly timed announcement", async () => {
    for (const input of [
      { level: "info", bodyZh: "", bodyEn: "x", hours: 1 },
      { level: "info", bodyZh: "x".repeat(501), bodyEn: "x", hours: 1 },
      { level: "info", bodyZh: "x", bodyEn: "x", hours: 0 },
      { level: "loud", bodyZh: "x", bodyEn: "x", hours: 1 },
    ]) {
      expect(await postSiteAnnouncement(input)).toEqual({
        ok: false,
        reason: "invalid",
      });
    }
    expect(await endSiteAnnouncement("not-an-id")).toEqual({
      ok: false,
      reason: "invalid",
    });
  });
});
