import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  groupSentenceReports,
  parseSentenceReport,
} from "@/lib/sentence-reports";

const state = vi.hoisted(() => ({
  user: { id: "u1" } as { id: string } | null,
  admin: null as { id: string } | null,
  inserted: [] as unknown[],
  allowed: true,
}));
vi.mock("@/auth/session", () => ({ getSignedInUser: async () => state.user }));
vi.mock("@/auth/creator", () => ({ getAdminUser: async () => state.admin }));
vi.mock("@/auth/rate-limit", () => ({
  allowAction: async () => state.allowed,
}));
vi.mock("@/auth/audit", () => ({ logAudit: async () => {} }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/auth/admin", () => ({ getAdminSupabase: () => null }));
vi.mock("@/auth/server", () => ({
  getServerSupabase: async () => ({
    from: () => ({
      insert: async (row: unknown) => {
        state.inserted.push(row);
        return { error: null };
      },
    }),
  }),
}));
const { reportSentence, resolveSentenceReports } =
  await import("@/app/reports/sentence-actions");

/** Reporting a problem with a sentence (D113). */
beforeEach(() => {
  state.user = { id: "u1" };
  state.admin = null;
  state.inserted = [];
  state.allowed = true;
});

const good = {
  videoId: "p-0b1d2c3e-4f50-4a6b-8c7d-9e0f1a2b3c4d",
  version: 2,
  index: 3,
  kind: "translation",
  note: "  應該是「右轉」 ",
};

describe("a learner's report", () => {
  it("is checked: a known kind, a sentence, a short note", () => {
    expect(parseSentenceReport(good)).toEqual({
      videoId: good.videoId,
      version: 2,
      index: 3,
      kind: "translation",
      note: "應該是「右轉」",
    });
    expect(parseSentenceReport({ ...good, kind: "spelling" })).toBeNull();
    expect(parseSentenceReport({ ...good, index: -1 })).toBeNull();
    expect(parseSentenceReport({ ...good, note: "x".repeat(501) })).toBeNull();
    expect(
      parseSentenceReport({ ...good, version: undefined, note: "" }),
    ).toMatchObject({ version: null, note: null });
  });

  it("is saved as the signed-in learner", async () => {
    expect(await reportSentence(good)).toEqual({ ok: true });
    expect(state.inserted).toEqual([
      expect.objectContaining({
        user_id: "u1",
        video_id: good.videoId,
        sentence_index: 3,
        kind: "translation",
        material_version: 2,
      }),
    ]);
  });

  it("needs a sign-in, and is rate limited", async () => {
    state.user = null;
    expect(await reportSentence(good)).toEqual({
      ok: false,
      reason: "signedOut",
    });
    state.user = { id: "u1" };
    state.allowed = false;
    expect(await reportSentence(good)).toEqual({ ok: false, reason: "busy" });
    expect(state.inserted).toEqual([]);
  });

  it("is closed only by an admin", async () => {
    expect(await resolveSentenceReports(["x"], "fixed", "")).toEqual({
      ok: false,
    });
  });
});

describe("the admin's list", () => {
  it("groups open reports by sentence, oldest first", () => {
    const row = (id: string, video: string, i: number, kind = "notes") => ({
      id,
      video_id: video,
      sentence_index: i,
      kind,
      note: null,
      created_at: "2026-11-11T00:00:00Z",
    });
    const groups = groupSentenceReports([
      row("a", "sintel", 2),
      row("b", "p-1", 0, "audio"),
      row("c", "sintel", 2, "translation"),
      row("d", "sintel", 2, "unknown"),
    ]);
    expect(
      groups.map((g) => [
        g.videoId,
        g.sentenceIndex,
        g.reports.map((r) => r.id),
      ]),
    ).toEqual([
      ["sintel", 2, ["a", "c"]],
      ["p-1", 0, ["b"]],
    ]);
  });
});
