import { beforeEach, describe, expect, it, vi } from "vitest";
import { can, PLANS } from "@/lib/plans";
import {
  activeOverrides,
  parseOverride,
  usageShare,
  withOverrides,
} from "@/lib/quota";

/** Storage, revises, and per-account changes (D161). */
const now = new Date("2026-11-13T12:00:00Z");
const later = "2026-11-20T00:00:00Z";
const earlier = "2026-11-10T00:00:00Z";

describe("per-account quota changes", () => {
  it("adds what's in force, and leaves unlimited alone", () => {
    const limits = withOverrides(
      PLANS.free,
      [
        { limit: "minutesPerWeek", extra: 5, expiresAt: later },
        { limit: "minutesPerWeek", extra: 3, expiresAt: earlier },
        { limit: "revisesPerDay", extra: -10, expiresAt: later },
        { limit: "minutesPerMonth", extra: 99, expiresAt: later },
      ],
      now,
    );
    expect(limits.minutesPerWeek).toBe(7);
    // Never below zero.
    expect(limits.revisesPerDay).toBe(0);
    // null (no monthly cap on the free plan) stays null.
    expect(limits.minutesPerMonth).toBeNull();
  });

  it("drops expired changes and odd rows", () => {
    expect(
      activeOverrides(
        [
          { limit: "minutesPerWeek", extra: 1, expiresAt: earlier },
          { limit: "minutesPerWeek", extra: 1, expiresAt: later },
        ],
        now,
      ),
    ).toHaveLength(1);
    expect(
      parseOverride({ limit_name: "nope", extra: 1, expires_at: later }),
    ).toBeNull();
    expect(
      parseOverride({
        limit_name: "revisesPerDay",
        extra: 2,
        expires_at: later,
      }),
    ).toEqual({ limit: "revisesPerDay", extra: 2, expiresAt: later });
  });

  it("reports the share used for the 80% warning", () => {
    expect(usageShare(8, 10)).toBe(0.8);
    expect(usageShare(20, 10)).toBe(1);
    expect(usageShare(3, null)).toBeNull();
    expect(usageShare(0, 0)).toBe(1);
  });
});

describe("storage and revise limits", () => {
  const mb = 1024 * 1024;
  it("caps each account's stored recordings by plan", () => {
    expect(
      can("paid", { kind: "store-audio", stored: 150 * mb, adding: 40 * mb })
        .ok,
    ).toBe(true);
    expect(
      can("paid", { kind: "store-audio", stored: 190 * mb, adding: 20 * mb }),
    ).toEqual({
      ok: false,
      limit: "storageMegabytes",
      max: 200,
    });
    expect(
      can("admin", { kind: "store-audio", stored: 1e12, adding: 1e9 }).ok,
    ).toBe(true);
  });

  it("counts revises a day", () => {
    expect(can("free", { kind: "revise", today: 4 }).ok).toBe(true);
    expect(can("free", { kind: "revise", today: 5 })).toEqual({
      ok: false,
      limit: "revisesPerDay",
      max: 5,
    });
  });
});

const state = vi.hoisted(() => ({
  orphans: [] as { bucket: string; path: string }[],
  counts: [] as { bucket: string; files: number }[],
  removed: [] as string[],
  deletedRows: [] as string[],
}));

describe("cleaning up unused files", () => {
  const admin = {
    rpc: async (name: string) =>
      name === "orphan_audio"
        ? { data: state.orphans, error: null }
        : { data: state.counts, error: null },
    storage: {
      from: () => ({
        remove: async (paths: string[]) => {
          state.removed.push(...paths);
          return { error: null };
        },
      }),
    },
    from: () => ({
      delete: () => ({
        in: async (_c: string, paths: string[]) => {
          state.deletedRows.push(...paths);
          return { error: null };
        },
      }),
    }),
  };
  beforeEach(() => {
    state.removed = [];
    state.deletedRows = [];
  });

  it("removes a few unused files and their cache rows", async () => {
    const { cleanOrphans } = await import("@/auth/orphans");
    state.orphans = [
      { bucket: "speech", path: "a.mp3" },
      { bucket: "uploads", path: "u/x.mp3" },
    ];
    state.counts = [
      { bucket: "speech", files: 100 },
      { bucket: "uploads", files: 10 },
    ];
    const result = await cleanOrphans(admin as never, now);
    expect(result).toEqual({
      status: "done",
      deleted: { speech: 1, uploads: 1 },
    });
    expect(state.removed).toEqual(["a.mp3", "u/x.mp3"]);
    expect(state.deletedRows).toEqual(["a.mp3"]);
  });

  it("holds back when too much of a bucket looks unused", async () => {
    const { cleanOrphans } = await import("@/auth/orphans");
    state.orphans = Array.from({ length: 30 }, (_, i) => ({
      bucket: "speech",
      path: `${i}.mp3`,
    }));
    state.counts = [{ bucket: "speech", files: 100 }];
    expect(await cleanOrphans(admin as never, now)).toEqual({
      status: "held",
      bucket: "speech",
      orphans: 30,
      files: 100,
    });
    expect(state.removed).toEqual([]);
  });
});
