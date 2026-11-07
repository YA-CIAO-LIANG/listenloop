import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  moveInOrder,
  officialColumns,
  officialState,
} from "@/lib/material-admin";

/** Managing materials (D58). */
describe("official states", () => {
  it("maps rows and columns both ways", () => {
    expect(officialState({ official: false, published: true })).toBe("none");
    expect(officialState({ official: true, published: false })).toBe("draft");
    expect(officialState({ official: true, published: true })).toBe(
      "published",
    );
    expect(officialColumns("draft")).toEqual({
      official: true,
      published: false,
      visibility: "private",
    });
    expect(officialColumns("published")).toMatchObject({
      visibility: "public",
    });
  });
});

describe("moveInOrder", () => {
  it("swaps with the neighbor, and stops at the ends", () => {
    expect(moveInOrder(["a", "b", "c"], "c", -1)).toEqual(["a", "c", "b"]);
    expect(moveInOrder(["a", "b", "c"], "a", -1)).toEqual(["a", "b", "c"]);
    expect(moveInOrder(["a", "b"], "x", 1)).toEqual(["a", "b"]);
  });
});

const db = vi.hoisted(() => ({
  practice: null as Record<string, unknown> | null,
  authorRole: "admin",
  updates: [] as unknown[],
  reserve: true,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const logAudit = vi.hoisted(() => vi.fn());
vi.mock("@/auth/audit", () => ({ logAudit }));
vi.mock("@/auth/creator", async () => {
  const { fakeLanguage, fakeSpeech } = await import("@/lib/ai/fake");
  return {
    getAdminUser: async () => ({ id: "admin-0" }),
    getCreator: async () => ({
      user: { id: "admin-0", email: "a@example.com", number: 0, role: "admin" },
      providers: { language: fakeLanguage, speech: fakeSpeech },
      meter: {
        reserve: async () => db.reserve,
        settle: async () => {},
        log: async () => {},
      },
      cache: { get: async () => null, set: async () => {} },
    }),
  };
});
vi.mock("@/auth/admin", () => ({
  getAdminSupabase: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: table === "profiles" ? { role: db.authorRole } : db.practice,
          }),
        }),
      }),
      update: (values: unknown) => {
        db.updates.push(values);
        const chain = {
          eq: () => chain,
          select: async () => ({ data: [{ id: "x" }], error: null }),
          then: (resolve: (value: { error: null }) => void) =>
            resolve({ error: null }),
        };
        return chain;
      },
    }),
  }),
}));

const {
  generateMaterialSubtitle,
  setMaterialCategory,
  setMaterialSubtitle,
  setOfficialState,
} = await import("@/app/admin/materials/actions");
const id = "123e4567-e89b-12d3-a456-426614174000";

beforeEach(() => {
  db.practice = {
    user_id: "admin-0",
    official: true,
    published: false,
    notes_generated_at: "2026-11-07T00:00:00Z",
    removed_at: null,
    title: "Checking In",
    subtitle: null,
    practice_sentences: [{ i: 0, en: "Hello.", audio_path: "a.mp3" }],
  };
  db.authorRole = "admin";
  db.updates = [];
  db.reserve = true;
  logAudit.mockReset();
});

describe("setOfficialState", () => {
  it("publishes a finished draft, and records it", async () => {
    expect(await setOfficialState(id, "published")).toEqual({ ok: true });
    expect(db.updates[0]).toEqual({
      official: true,
      published: true,
      visibility: "public",
    });
    expect(logAudit).toHaveBeenCalledWith(
      "admin-0",
      "practice.official-state",
      { type: "practice", id },
      { from: "draft", to: "published" },
    );
  });

  it("won't publish without notes and audio, or a learner's practice", async () => {
    db.practice!.practice_sentences = [{ audio_path: null }];
    expect(await setOfficialState(id, "published")).toEqual({
      ok: false,
      reason: "not-ready",
    });
    db.authorRole = "user";
    expect(await setOfficialState(id, "draft")).toEqual({
      ok: false,
      reason: "not-admin-made",
    });
    // Anyone's practice can stop being official.
    expect(await setOfficialState(id, "none")).toEqual({ ok: true });
  });

  it("refuses bad input", async () => {
    expect(await setOfficialState("x", "draft")).toMatchObject({
      reason: "invalid",
    });
    expect(await setOfficialState(id, "featured")).toMatchObject({
      reason: "invalid",
    });
  });
});

describe("setMaterialCategory", () => {
  it("saves a checked category, or clears it", async () => {
    expect(
      await setMaterialCategory(id, {
        category: "exam",
        scenario: "toefl-campus",
        level: "intermediate",
        exam: "toefl",
        examTarget: "toefl-80",
      }),
    ).toEqual({ ok: true });
    expect(db.updates[0]).toMatchObject({
      exam: "toefl",
      exam_target: "toefl-80",
    });
    expect(await setMaterialCategory(id, null)).toEqual({ ok: true });
    expect(db.updates[1]).toMatchObject({ category: null, scenario: null });
    expect(
      await setMaterialCategory(id, { category: "exam", scenario: "nope" }),
    ).toMatchObject({ reason: "invalid" });
  });
});

describe("subtitles (D71)", () => {
  it("are written when a draft is published without one", async () => {
    expect(await setOfficialState(id, "published")).toEqual({ ok: true });
    expect(db.updates[1]).toEqual({ subtitle: "Checking In（練習）" });
  });

  it("keep one that's already there on publishing", async () => {
    db.practice!.subtitle = "在機場報到。";
    await setOfficialState(id, "published");
    expect(db.updates).toHaveLength(1);
  });

  it("don't stop publishing when the model can't run", async () => {
    db.reserve = false;
    expect(await setOfficialState(id, "published")).toEqual({ ok: true });
    expect(db.updates).toHaveLength(1);
  });

  it("can be rewritten with AI, and the limit is reported", async () => {
    db.practice!.subtitle = "舊的。";
    expect(await generateMaterialSubtitle(id)).toEqual({ ok: true });
    expect(db.updates[0]).toEqual({ subtitle: "Checking In（練習）" });
    expect(logAudit).toHaveBeenCalledWith(
      "admin-0",
      "practice.subtitle",
      { type: "practice", id },
      { to: "Checking In（練習）", by: "ai" },
    );
    db.reserve = false;
    expect(await generateMaterialSubtitle(id)).toEqual({
      ok: false,
      reason: "limit",
    });
  });

  it("can be typed, cleared, and are checked", async () => {
    expect(await setMaterialSubtitle(id, " 「在機場報到」 ")).toEqual({
      ok: true,
    });
    expect(db.updates[0]).toEqual({ subtitle: "在機場報到" });
    expect(await setMaterialSubtitle(id, "")).toEqual({ ok: true });
    expect(db.updates[1]).toEqual({ subtitle: null });
    expect(await setMaterialSubtitle(id, "長".repeat(61))).toMatchObject({
      reason: "invalid",
    });
  });
});
