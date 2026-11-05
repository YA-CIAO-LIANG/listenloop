import { describe, expect, it, vi } from "vitest";
import { fakeLanguage, fakeSpeech } from "@/lib/ai/fake";
import {
  checkGeneratedText,
  compositionPrompt,
  expectedChars,
  GENERATION_CATEGORIES,
  parseGenerationRequest,
  WORDS_PER_MINUTE,
} from "@/lib/custom-practice/generation";
import en from "@/messages/en.json";
import zh from "@/messages/zh-Hant.json";

const state = vi.hoisted(() => ({ creator: true, reserve: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/auth/server", () => ({ getServerSupabase: async () => null }));
vi.mock("@/auth/creator", () => ({
  getCreator: async () =>
    state.creator
      ? {
          user: { id: "user-1", email: "joe@example.com" },
          providers: { language: fakeLanguage, speech: fakeSpeech },
          meter: { reserve: state.reserve },
          cache: { get: async () => null, set: async () => {} },
        }
      : null,
}));
const { generatePracticeText } = await import("@/app/materials/actions");

const request = {
  topic: " 第一次 去超市 ",
  scenario: "shopping",
  level: "beginner",
  minutes: 1,
  format: "dialogue",
};

describe("generation settings", () => {
  it("lists Joe's eight categories, each with scenarios", () => {
    expect(GENERATION_CATEGORIES.map((c) => c.id)).toEqual([
      "daily-life",
      "study-abroad",
      "casual-american",
      "campus",
      "academic-writing",
      "business",
      "talks-stories",
      "exam",
    ]);
    const ids = GENERATION_CATEGORIES.flatMap((c) =>
      c.scenarios.map((s) => s.id),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("names every category and scenario in both languages", () => {
    for (const messages of [en, zh]) {
      for (const category of GENERATION_CATEGORIES) {
        expect(messages.generate.categories).toHaveProperty(category.id);
        for (const scenario of category.scenarios) {
          expect(messages.generate.scenarios).toHaveProperty(scenario.id);
        }
      }
    }
  });
});

describe("parseGenerationRequest", () => {
  it("tidies the topic and keeps the choices", () => {
    expect(parseGenerationRequest(request)).toEqual({
      ...request,
      topic: "第一次 去超市",
    });
  });

  it.each([
    ["an unknown scenario", { scenario: "skydiving" }],
    ["an unknown level", { level: "expert" }],
    ["a length not offered", { minutes: 2 }],
    ["an unknown format", { format: "poem" }],
    ["a topic too long", { topic: "x".repeat(201) }],
  ])("refuses %s", (_, change) => {
    expect(parseGenerationRequest({ ...request, ...change })).toBeNull();
  });

  it("asks for about 130 words a minute", () => {
    const prompt = compositionPrompt(parseGenerationRequest(request)!);
    expect(prompt.words).toBe(WORDS_PER_MINUTE);
    expect(prompt.scenario).toBe("shopping in a store");
    expect(expectedChars(prompt)).toBe(WORDS_PER_MINUTE * 6 + 7);
  });
});

describe("checkGeneratedText", () => {
  const lines = Array(10).fill("We need milk, eggs, and some bread today.");

  it("joins the lines, one sentence or turn each", () => {
    expect(checkGeneratedText({ title: " At the Store ", lines }, 80)).toEqual({
      title: "At the Store",
      text: lines.join("\n"),
    });
  });

  it.each([
    ["no title", { lines }],
    ["no lines", { title: "T", lines: [] }],
    ["far too short", { title: "T", lines: ["Hi there."] }],
    ["not an object", "text"],
  ])("refuses %s", (_, raw) => {
    expect(checkGeneratedText(raw, 80)).toBeNull();
  });
});

describe("generatePracticeText", () => {
  it("writes text, reserving the expected length first", async () => {
    state.creator = true;
    state.reserve.mockReset().mockResolvedValue(true);
    const result = await generatePracticeText(request);
    expect(result.ok && result.title).toBe("Practice: shopping in a store");
    expect(result.ok && result.text.split("\n").length).toBeGreaterThan(5);
    expect(state.reserve).toHaveBeenCalledWith(
      "translation",
      WORDS_PER_MINUTE * 6 + 7,
    );
  });

  it("stops at the daily limit, and for bad requests and non-admins", async () => {
    state.reserve.mockReset().mockResolvedValue(false);
    expect(await generatePracticeText(request)).toEqual({
      ok: false,
      reason: "limit",
    });
    expect(
      await generatePracticeText({ ...request, scenario: "nope" }),
    ).toEqual({ ok: false, reason: "invalid" });
    state.creator = false;
    expect(await generatePracticeText(request)).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });
});
