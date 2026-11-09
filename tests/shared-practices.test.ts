import { beforeEach, describe, expect, it, vi } from "vitest";
import { PREVIEW_SENTENCES, sharedPreview } from "@/lib/practice-material";

/**
 * Shared materials are for paying plans (D106): /explore lists only the
 * practices people shared (official ones live in the home page's
 * library), readiness is counted by the database, and a free account
 * sees a preview of three sentences.
 */
const shared = "0b1d2c3e-4f50-4a6b-8c7d-9e0f1a2b3c4d";
const state = vi.hoisted(() => ({
  calls: [] as [string, ...unknown[]][],
  counts: [] as { practice_id: string; sentences: number; voiced: number }[],
}));

vi.mock("@/auth/session", () => ({ getSignedInUser: async () => null }));
vi.mock("@/auth/server", () => ({
  getServerSupabase: async () => {
    const query: Record<string, unknown> = {};
    for (const step of ["select", "eq", "is", "not", "order", "in"]) {
      query[step] = (...args: unknown[]) => {
        state.calls.push([step, ...args]);
        return query;
      };
    }
    query.limit = async () => ({
      data: [
        {
          id: shared,
          title: "Ordering coffee",
          title_en: "Ordering coffee",
          title_zh: "點咖啡",
          subtitle: null,
          source_language: "en",
          voice: "us-female",
          created_at: "2026-11-10T00:00:00Z",
          category: "travel",
          scenario: null,
          exam: null,
          exam_target: null,
          level: "beginner",
          sort_order: null,
          youtube_id: null,
          duration_sec: 40,
        },
      ],
      error: null,
    });
    return {
      from: () => query,
      rpc: async (name: string, args: unknown) => {
        state.calls.push(["rpc", name, args]);
        return { data: state.counts, error: null };
      },
    };
  },
}));

const { listPublicPractices } = await import("@/auth/public-practices");

beforeEach(() => {
  state.calls = [];
  state.counts = [{ practice_id: shared, sentences: 6, voiced: 6 }];
});

describe("/explore lists only shared materials (D106)", () => {
  it("asks for practices that aren't official", async () => {
    await listPublicPractices();
    expect(state.calls).toContainEqual(["eq", "official", false]);
    expect(state.calls).not.toContainEqual(["eq", "official", true]);
  });

  it("counts sentences with the database, not by reading them", async () => {
    const [practice] = await listPublicPractices();
    expect(practice).toMatchObject({ id: `p-${shared}`, sentenceCount: 6 });
    expect(state.calls).toContainEqual([
      "rpc",
      "public_practice_readiness",
      { targets: [shared] },
    ]);
    const select = state.calls.find(([step]) => step === "select");
    expect(String(select?.[1])).not.toMatch(/practice_sentences|vocab/);
  });

  it("leaves out practices not fully voiced", async () => {
    state.counts = [{ practice_id: shared, sentences: 6, voiced: 5 }];
    expect(await listPublicPractices()).toEqual([]);
  });
});

describe("the preview (D106)", () => {
  const row = {
    id: shared,
    title: "Ordering coffee",
    title_en: "Ordering coffee",
    title_zh: "點咖啡",
    subtitle: "在咖啡店點餐",
    category: "travel",
    scenario: null,
    level: "beginner",
    voice: "gb-male",
    duration_sec: 75,
    youtube_id: null,
  };
  const answer = {
    sentence_count: 12,
    sentences: [
      { i: 0, en: "Hi there.", zh: "嗨。" },
      { i: 1, en: "A latte, please.", zh: "請給我一杯拿鐵。" },
      { i: 2, en: "To go.", zh: "外帶。" },
    ],
    audio_path: "abc.mp3",
  };

  it("has the details, three sentences, and the first one's audio", () => {
    const preview = sharedPreview(row, answer, (path) => `/audio/${path}`);
    expect(preview).toMatchObject({
      id: `p-${shared}`,
      title: "Ordering coffee",
      titleZh: "點咖啡",
      subtitle: "在咖啡店點餐",
      category: "travel",
      level: "beginner",
      accent: "gb",
      durationSec: 75,
      sentenceCount: 12,
      audioUrl: "/audio/abc.mp3",
    });
    expect(preview?.sentences).toHaveLength(PREVIEW_SENTENCES);
    expect(preview?.sentences[0]).toEqual({ en: "Hi there.", zh: "嗨。" });
  });

  it("never shows more than three, even if more come back", () => {
    const more = {
      ...answer,
      sentences: [...answer.sentences, { i: 3, en: "Thanks.", zh: "謝謝。" }],
    };
    expect(sharedPreview(row, more, () => null)?.sentences).toHaveLength(3);
  });

  it("is nothing when the database has no preview", () => {
    expect(sharedPreview(row, null, () => null)).toBeNull();
    expect(sharedPreview(row, { sentences: [] }, () => null)).toBeNull();
  });
});
