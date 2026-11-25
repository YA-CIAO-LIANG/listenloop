import { describe, expect, it, vi } from "vitest";
import { composeBudget } from "@/lib/ai/budgets";
import { COMPOSE_INSTRUCTIONS, composeInstructions } from "@/lib/ai/prompts";
import { fakeLanguage, fakeSpeech } from "@/lib/ai/fake";
import {
  allScenarioIds,
  CATEGORIES,
  CATEGORY_IDS,
  EXAMS,
  findScenario,
  LEVEL_PROMPTS,
  targetMessageKey,
} from "@/lib/categories";
import {
  checkGeneratedText,
  compositionPrompt,
  FREE_TOPIC,
  lengthSeconds,
  lengthWords,
  materialMeta,
  parseGenerationRequest,
  parseMaterialMeta,
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
          user: {
            id: "user-1",
            email: "joe@example.com",
            number: 0,
            role: "admin",
          },
          providers: { language: fakeLanguage, speech: fakeSpeech },
          meter: {
            reserve: state.reserve,
            settle: async () => {},
            log: async () => {},
          },
          cache: { get: async () => null, set: async () => {} },
        }
      : null,
}));
const { generatePracticeText } = await import("@/app/materials/actions");

const request = {
  topic: " 第一次 去超市 ",
  scenario: "supermarket",
  level: "beginner",
  length: "1-2",
  format: "dialogue",
  accent: "gb",
};

describe("categories (D57)", () => {
  it("lists Joe's categories, then exam and other, with unique scenario ids (D57, D81, D82)", () => {
    expect(CATEGORY_IDS).toEqual([
      "daily-life",
      "travel",
      "study-abroad",
      "casual-american",
      "campus",
      "academic-writing",
      "business",
      "news",
      "science",
      "talks-stories",
      "health",
      "relationships",
      "tech",
      "money-admin",
      "career",
      "leisure",
      "food",
      "culture",
      // The series added on 2026-11-25 (D213).
      "classics",
      "school",
      "exam",
      "other",
    ]);
    const ids = allScenarioIds();
    expect(new Set(ids).size).toBe(ids.length);
    expect(EXAMS.map((e) => e.id)).toEqual([
      "toefl",
      "ielts",
      "toeic",
      "gept",
      "gsat",
    ]);
  });

  it("gives every category at least 8 scenarios (D81)", () => {
    for (const category of CATEGORIES) {
      expect(category.scenarios.length, category.id).toBeGreaterThanOrEqual(8);
    }
  });

  it("names every category, scenario, exam, and target in both languages", () => {
    for (const messages of [en, zh]) {
      for (const id of CATEGORY_IDS) {
        expect(messages.categories.names).toHaveProperty([id]);
      }
      for (const id of allScenarioIds()) {
        expect(messages.categories.scenarios).toHaveProperty([id]);
      }
      for (const exam of EXAMS) {
        expect(messages.categories.exams).toHaveProperty([exam.id]);
        for (const target of exam.targets) {
          expect(messages.categories.targets).toHaveProperty([
            targetMessageKey(target.id),
          ]);
        }
      }
    }
  });

  it("asks exam texts to be original, and news to be invented", () => {
    for (const exam of EXAMS) expect(exam.style).toMatch(/original/);
    expect(findScenario("news-tech")?.scenario.prompt).toMatch(/invented/);
  });
});

describe("parseGenerationRequest", () => {
  it("tidies the topic and keeps the choices", () => {
    expect(parseGenerationRequest(request)).toEqual({
      ...request,
      topic: "第一次 去超市",
      customScenario: "",
      customCategory: "",
      titleEn: "",
      titleZh: "",
    });
  });

  it("takes a category of one's own, filed under other (D82)", () => {
    const own = parseGenerationRequest({
      ...request,
      scenario: "",
      customCategory: " 天文攝影 ",
    });
    expect(own).toMatchObject({ scenario: "", customCategory: "天文攝影" });
    expect(materialMeta(own!)).toEqual({
      category: "other",
      scenario: null,
      level: "beginner",
      exam: null,
      examTarget: null,
      // It becomes a folder of that name in My materials (D147).
      folder: "天文攝影",
    });
    // One's own category has no scenarios from the list.
    expect(
      parseGenerationRequest({ ...request, customCategory: "天文攝影" }),
    ).toBeNull();
    expect(
      parseMaterialMeta({
        category: "other",
        scenario: null,
        level: "advanced",
        exam: null,
        examTarget: null,
      }),
    ).toMatchObject({ category: "other", level: "advanced" });
    expect(
      parseMaterialMeta({
        category: "other",
        scenario: null,
        level: "advanced",
        exam: null,
        examTarget: null,
        folder: " 天文攝影 ",
      })?.folder,
    ).toBe("天文攝影");
    expect(
      parseMaterialMeta({
        category: "other",
        scenario: null,
        level: "advanced",
        exam: null,
        examTarget: null,
        folder: "長".repeat(200),
      })?.folder,
    ).toBeUndefined();
    expect(composeInstructions({ words: 150, customCategory: "x" })).toMatch(
      /subject area/,
    );
  });

  it("takes a scenario of one's own, with a category's or on its own (D81)", () => {
    const own = "跟教授請病假並詢問補交作業";
    expect(
      parseGenerationRequest({ ...request, customScenario: ` ${own} ` }),
    ).toMatchObject({ scenario: "supermarket", customScenario: own });
    expect(
      parseGenerationRequest({ ...request, scenario: "", customScenario: own }),
    ).toMatchObject({ scenario: "", customScenario: own });
    // Neither a scenario nor a description: nothing to write about.
    // Nothing chosen or described: AI picks the topic and files it (D154).
    const open = parseGenerationRequest({ ...request, scenario: "" });
    expect(open).toMatchObject({ scenario: "", customScenario: "" });
    expect(compositionPrompt(open!).scenario).toBe(FREE_TOPIC);
    expect(materialMeta(open!)).toBeNull();
    // A scenario that isn't on the list is still refused.
    expect(parseGenerationRequest({ ...request, scenario: "moon" })).toBeNull();
    expect(
      parseGenerationRequest({ ...request, customScenario: "長".repeat(201) }),
    ).toBeNull();
  });

  it("keeps a title exactly as typed, only its ends trimmed (D81)", () => {
    expect(
      parseGenerationRequest({
        ...request,
        titleEn: "  My  Sick-Day   Email! ",
        titleZh: " 請  病假 ",
      }),
    ).toMatchObject({ titleEn: "My  Sick-Day   Email!", titleZh: "請  病假" });
  });

  it("takes an exam part with one of its exam's targets", () => {
    const exam = {
      ...request,
      scenario: "ielts-part1",
      level: "ielts-6.5",
    };
    expect(parseGenerationRequest(exam)).toMatchObject({ level: "ielts-6.5" });
    expect(parseGenerationRequest({ ...exam, level: "toeic-750" })).toBeNull();
    expect(parseGenerationRequest({ ...exam, level: "beginner" })).toBeNull();
  });

  it.each([
    ["an unknown scenario", { scenario: "skydiving" }],
    ["an unknown level", { level: "expert" }],
    ["a length not offered", { length: "8-plus" }],
    ["an unknown format", { format: "poem" }],
    ["an unknown accent", { accent: "nz" }],
    ["a topic too long", { topic: "x".repeat(201) }],
  ])("refuses %s", (_, change) => {
    expect(parseGenerationRequest({ ...request, ...change })).toBeNull();
  });

  it("asks for the middle of the length, in the chosen English", () => {
    const prompt = compositionPrompt(parseGenerationRequest(request)!);
    expect(prompt.words).toBe(Math.round(1.5 * WORDS_PER_MINUTE));
    expect(prompt.scenario).toBe("shopping at a supermarket");
    expect(prompt.level).toBe(
      `${LEVEL_PROMPTS.beginner}; British English spelling and expressions`,
    );
    expect(lengthWords("4-5")).toBe(Math.round(4.5 * WORDS_PER_MINUTE));
    expect(composeBudget(prompt)).toMatchObject({ operation: "compose" });
  });

  it("pitches an exam text at its target, in the exam's style", () => {
    const prompt = compositionPrompt(
      parseGenerationRequest({
        ...request,
        scenario: "toeic-conversation",
        level: "toeic-750",
      })!,
    );
    expect(prompt.scenario).toMatch(/TOEIC/);
    expect(prompt.level).toMatch(/750/);
  });
});

describe("material meta", () => {
  it("records where a request's text belongs", () => {
    expect(materialMeta(parseGenerationRequest(request)!)).toEqual({
      category: "daily-life",
      scenario: "supermarket",
      level: "beginner",
      exam: null,
      examTarget: null,
    });
    const exam = materialMeta(
      parseGenerationRequest({
        ...request,
        scenario: "gept-conversation",
        level: "gept-high-intermediate",
      })!,
    );
    expect(exam).toEqual({
      category: "exam",
      scenario: "gept-conversation",
      level: "advanced",
      exam: "gept",
      examTarget: "gept-high-intermediate",
    });
    expect(parseMaterialMeta(exam)).toEqual(exam);
  });

  it.each([
    {
      category: "travel",
      scenario: "supermarket",
      level: "beginner",
      exam: null,
      examTarget: null,
    },
    {
      category: "exam",
      scenario: "gept-conversation",
      level: "advanced",
      exam: "gept",
      examTarget: "toeic-900",
    },
    {
      category: "daily-life",
      scenario: "supermarket",
      level: "beginner",
      exam: "gept",
      examTarget: null,
    },
    null,
  ])("refuses %j", (raw) => {
    expect(parseMaterialMeta(raw)).toBeNull();
  });
});

describe("checkGeneratedText", () => {
  const lines = Array(10).fill("We need milk, eggs, and some bread today.");

  it("joins the lines, one sentence or turn each", () => {
    expect(checkGeneratedText({ title: " At the Store ", lines }, 80)).toEqual({
      title: "At the Store",
      titleZh: "",
      subtitle: "",
      text: lines.join("\n"),
      category: null,
    });
  });

  it("keeps a category the model chose from the list, and only those (D153)", () => {
    expect(
      checkGeneratedText({ title: "T", lines, category: "health" }, 80)
        ?.category,
    ).toBe("health");
    expect(
      checkGeneratedText({ title: "T", lines, category: "other" }, 80)
        ?.category,
    ).toBe("other");
    expect(
      checkGeneratedText({ title: "T", lines, category: "exam" }, 80)?.category,
    ).toBeNull();
    expect(
      checkGeneratedText({ title: "T", lines, category: "cooking" }, 80)
        ?.category,
    ).toBeNull();
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
  it("writes text, reserving the worst-case cost first", async () => {
    state.creator = true;
    state.reserve.mockReset().mockResolvedValue(true);
    const result = await generatePracticeText(request);
    expect(result.ok && result.titleEn).toBe(
      "Practice: shopping at a supermarket",
    );
    // The model also writes the Chinese title and the subtitle (D83).
    expect(result.ok && result.titleZh).toBe("練習（測試）");
    expect(result.ok && result.subtitle).toBe("測試用的練習內容");
    expect(result.ok && result.text.split("\n").length).toBeGreaterThan(5);
    // The fake is free, so the worst case reserved is 0 (D38).
    expect(state.reserve).toHaveBeenCalledWith("cost", 0);
  });

  it("never changes a title the learner gave, in either language (D81, D83)", async () => {
    state.creator = true;
    state.reserve.mockReset().mockResolvedValue(true);
    const zhOnly = await generatePracticeText({
      ...request,
      titleZh: "  跟教授 請病假 ",
    });
    expect(zhOnly.ok && zhOnly.titleZh).toBe("跟教授 請病假");
    // The English one is written.
    expect(zhOnly.ok && zhOnly.titleEn).toBe(
      "Practice: shopping at a supermarket",
    );
    const enOnly = await generatePracticeText({
      ...request,
      titleEn: "  Asking  for Sick Leave ",
    });
    expect(enOnly.ok && enOnly.titleEn).toBe("Asking  for Sick Leave");
    expect(enOnly.ok && enOnly.titleZh).toBe("練習（測試）");
    const both = await generatePracticeText({
      ...request,
      titleEn: "Mine",
      titleZh: "我的",
    });
    expect(both.ok && [both.titleEn, both.titleZh]).toEqual(["Mine", "我的"]);
    const own = await generatePracticeText({
      ...request,
      scenario: "",
      customScenario: "asking a professor for sick leave",
    });
    expect(own.ok).toBe(true);
  });

  it("only asks about a custom scenario or title when there is one", () => {
    expect(
      compositionPrompt(parseGenerationRequest(request)!),
    ).not.toHaveProperty("titleEn");
    const plain = composeInstructions({ words: 150 });
    expect(plain.startsWith(COMPOSE_INSTRUCTIONS)).toBe(true);
    expect(plain).not.toMatch(
      /exactly as given|titleZh exactly|customScenario/,
    );
    expect(composeInstructions({ words: 150, titleEn: "T" })).toMatch(
      /exactly as given/,
    );
    expect(composeInstructions({ words: 150, titleZh: "標" })).toMatch(
      /titleZh exactly/,
    );
    expect(
      compositionPrompt(
        parseGenerationRequest({
          ...request,
          titleEn: "T",
          customScenario: "x",
        })!,
      ),
    ).toMatchObject({ titleEn: "T", customScenario: "x" });
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

describe("lengths (D94)", () => {
  it("asks for 30 seconds or one's own length in words", () => {
    // 150 words a minute (D142).
    expect(lengthWords("30s")).toBe(75);
    expect(lengthWords("custom", 90)).toBe(225);
    expect(lengthWords("1-2")).toBe(225);
    expect(lengthSeconds("2-3")).toBe(180);
    expect(lengthSeconds("custom", 45)).toBe(45);
  });

  it("takes a length of one's own between 15 seconds and 10 minutes", () => {
    expect(
      parseGenerationRequest({ ...request, length: "custom", seconds: 45 }),
    ).toMatchObject({ length: "custom", seconds: 45 });
    for (const seconds of [14, 601, 30.5, "60", undefined]) {
      expect(
        parseGenerationRequest({ ...request, length: "custom", seconds }),
      ).toBeNull();
    }
    expect(
      compositionPrompt(
        parseGenerationRequest({ ...request, length: "custom", seconds: 60 })!,
      ).words,
    ).toBe(150);
  });
});
