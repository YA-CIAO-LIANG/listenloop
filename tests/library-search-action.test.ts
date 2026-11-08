import { beforeEach, describe, expect, it, vi } from "vitest";
import { excerptSeconds } from "@/lib/excerpt-length";
import { VIDEO_CATEGORY_IN_LIBRARY } from "@/lib/library";
import { getAllVideos } from "@/lib/video-library";

const uuid = "0b1d2c3e-4f50-4a6b-8c7d-9e0f1a2b3c4d";
const state = vi.hoisted(() => ({
  calls: [] as [string, ...unknown[]][],
  error: null as { message: string } | null,
}));

vi.mock("@/auth/session", () => ({ getSignedInUser: async () => null }));
vi.mock("@/auth/server", () => ({
  getServerSupabase: async () => {
    // A chainable query that records each step.
    const query: Record<string, unknown> = {};
    for (const step of ["select", "eq", "is", "overlaps", "gte", "lte"]) {
      query[step] = (...args: unknown[]) => {
        state.calls.push([step, ...args]);
        return query;
      };
    }
    query.limit = async () => ({
      data: state.error ? null : [{ id: uuid }],
      error: state.error,
    });
    return { from: () => query };
  },
}));

const { searchOfficialLibrary } = await import("@/app/library-actions");

beforeEach(() => {
  state.calls = [];
  state.error = null;
});

const steps = (name: string) =>
  state.calls.filter(([step]) => step === name).map(([, ...args]) => args);

describe("searchOfficialLibrary (D104)", () => {
  it("matches categories with overlaps and the length with gte / lte", async () => {
    const result = await searchOfficialLibrary({
      categories: ["travel", "food"],
      length: "3-5",
    });
    expect(result.ok && result.ids).toContain(`p-${uuid}`);
    expect(steps("overlaps")).toEqual([["categories", ["travel", "food"]]]);
    expect(steps("gte")).toEqual([["duration_sec", 180]]);
    expect(steps("lte")).toEqual([["duration_sec", 299]]);
    // Only published official materials.
    expect(steps("eq")).toEqual(
      expect.arrayContaining([
        ["official", true],
        ["published", true],
        ["visibility", "public"],
      ]),
    );
  });

  it("leaves out what isn't chosen", async () => {
    await searchOfficialLibrary({ categories: [], length: "10-plus" });
    expect(steps("overlaps")).toEqual([]);
    expect(steps("gte")).toEqual([["duration_sec", 600]]);
    expect(steps("lte")).toEqual([]);
  });

  it("tests the built-in videos with the same rules", async () => {
    const video = getAllVideos()[0];
    const category = VIDEO_CATEGORY_IN_LIBRARY[video.category]!;
    const seconds = excerptSeconds(video.sentences);
    const length = seconds < 180 ? "under-3" : seconds < 300 ? "3-5" : "5-10";
    const found = await searchOfficialLibrary({
      categories: [category],
      length,
    });
    expect(found.ok && found.ids).toContain(video.id);
    const other = await searchOfficialLibrary({
      categories: [category],
      length: "10-plus",
    });
    expect(other.ok && other.ids).not.toContain(video.id);
  });

  it("refuses unknown values and more than five categories", async () => {
    expect(
      await searchOfficialLibrary({ categories: ["nope"], length: "all" }),
    ).toEqual({ ok: false, reason: "invalid" });
    expect(
      await searchOfficialLibrary({ categories: [], length: "2-4" }),
    ).toEqual({ ok: false, reason: "invalid" });
    expect(
      await searchOfficialLibrary({
        categories: ["travel", "food", "news", "health", "tech", "career"],
        length: "all",
      }),
    ).toEqual({ ok: false, reason: "invalid" });
    expect(state.calls).toEqual([]);
  });

  it("says when the database fails", async () => {
    state.error = { message: "down" };
    expect(
      await searchOfficialLibrary({ categories: ["travel"], length: "all" }),
    ).toEqual({ ok: false, reason: "failed" });
  });
});
