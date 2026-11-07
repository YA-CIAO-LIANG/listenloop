import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  adminPeriods,
  ADMIN_SECTIONS,
  taiwanToday,
} from "@/lib/admin-dashboard";
import { rankHardSentences } from "@/lib/hard-sentences";
import en from "@/messages/en.json";
import zh from "@/messages/zh-Hant.json";

/** The admin dashboard (D56). */
describe("taiwanToday", () => {
  it("is the date in UTC+8", () => {
    expect(taiwanToday(new Date("2026-11-07T15:59:00Z"))).toBe("2026-11-07");
    expect(taiwanToday(new Date("2026-11-07T16:00:00Z"))).toBe("2026-11-08");
  });
});

describe("adminPeriods", () => {
  it("counts the week as the last 7 Taiwan days, today included", () => {
    expect(adminPeriods(new Date("2026-11-07T03:00:00Z"))).toEqual({
      dayStart: "2026-11-06T16:00:00.000Z",
      weekStart: "2026-10-31T16:00:00.000Z",
      monthStart: "2026-10-31T16:00:00.000Z",
    });
  });
});

describe("rankHardSentences", () => {
  const row = (
    video: string,
    i: number,
    coverages: number[],
    skipped: boolean,
  ) => ({
    video_id: video,
    sentence_index: i,
    coverages,
    skipped,
    created_at: "2026-11-07T00:00:00Z",
  });

  it("puts the most skipped first, then the lowest coverage", () => {
    const ranked = rankHardSentences([
      row("a", 0, [0.4, 0.4], false),
      row("a", 1, [0.1, 0.2], false),
      row("b", 2, [0.4], true),
      row("b", 2, [0.2], false),
    ]);
    expect(ranked.map((r) => `${r.videoId}#${r.sentenceIndex}`)).toEqual([
      "b#2",
      "a#1",
      "a#0",
    ]);
    expect(ranked[0]).toMatchObject({ reports: 2, skips: 1 });
    expect(ranked[0].averageCoverage).toBeCloseTo(0.3);
  });
});

describe("admin nav", () => {
  it("names every section in both languages", () => {
    for (const messages of [en, zh]) {
      for (const { id } of ADMIN_SECTIONS) {
        expect(messages.admin.nav).toHaveProperty([id]);
      }
    }
  });
});

const db = vi.hoisted(() => ({
  actor: { id: "admin-0" } as { id: string } | null,
  profile: { number: 1, role: "user", status: "active" } as Record<
    string,
    unknown
  > | null,
  email: "learner@example.com",
  ban: vi.fn(),
  update: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const logAudit = vi.hoisted(() => vi.fn());
vi.mock("@/auth/audit", () => ({ logAudit }));
vi.mock("@/auth/creator", () => ({ getAdminUser: async () => db.actor }));
vi.mock("@/auth/admin", () => ({
  getAdminSupabase: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: db.profile }) }),
      }),
      update: (values: unknown) => ({
        eq: async () => (db.update(values), { error: null }),
      }),
    }),
    auth: {
      admin: {
        getUserById: async () => ({ data: { user: { email: db.email } } }),
        updateUserById: async (_: string, attrs: unknown) => (
          db.ban(attrs),
          { error: null }
        ),
      },
    },
  }),
}));

const { changeUser } = await import("@/app/admin/users/actions");
const target = "123e4567-e89b-12d3-a456-426614174000";

beforeEach(() => {
  db.actor = { id: "admin-0" };
  db.profile = { number: 1, role: "user", status: "active" };
  db.email = "learner@example.com";
  db.ban.mockReset();
  db.update.mockReset();
  logAudit.mockReset();
  vi.stubEnv("ADMIN_EMAILS", "owner@example.com");
});

describe("changeUser (D50, D56)", () => {
  it("makes an admin and records it", async () => {
    expect(await changeUser(target, { role: "admin" })).toEqual({ ok: true });
    expect(db.update).toHaveBeenCalledWith({ role: "admin" });
    expect(logAudit).toHaveBeenCalledWith(
      "admin-0",
      "user.role",
      { type: "user", id: "user-1" },
      { from: "user", to: "admin" },
    );
  });

  it("moves an account to the paid plan and back (D72)", async () => {
    db.profile = { ...db.profile, plan: "free" };
    expect(await changeUser(target, { plan: "paid" })).toEqual({ ok: true });
    expect(db.update).toHaveBeenCalledWith({ plan: "paid" });
    expect(logAudit).toHaveBeenCalledWith(
      "admin-0",
      "user.plan",
      { type: "user", id: "user-1" },
      { from: "free", to: "paid" },
    );
    expect(db.ban).not.toHaveBeenCalled();
    expect(await changeUser(target, { plan: "gold" })).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("disables with a ban, and restores by lifting it", async () => {
    await changeUser(target, { status: "disabled" });
    expect(db.ban).toHaveBeenLastCalledWith({ ban_duration: "876000h" });
    await changeUser(target, { status: "active" });
    expect(db.ban).toHaveBeenLastCalledWith({ ban_duration: "none" });
  });

  it("refuses your own account, listed admins, bad input, and non-admins", async () => {
    expect(await changeUser("admin-0", { role: "user" })).toMatchObject({
      ok: false,
      reason: "invalid",
    });
    db.actor = { id: target };
    expect(await changeUser(target, { role: "user" })).toEqual({
      ok: false,
      reason: "self",
    });
    db.actor = { id: "admin-0" };
    db.email = "Owner@Example.com";
    expect(await changeUser(target, { status: "disabled" })).toEqual({
      ok: false,
      reason: "listed",
    });
    expect(await changeUser(target, { role: "boss" })).toEqual({
      ok: false,
      reason: "invalid",
    });
    db.actor = null;
    expect(await changeUser(target, { role: "admin" })).toEqual({
      ok: false,
      reason: "unavailable",
    });
    expect(db.update).not.toHaveBeenCalled();
  });
});
