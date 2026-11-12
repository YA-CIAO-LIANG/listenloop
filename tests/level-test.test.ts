import { describe, expect, it } from "vitest";
import {
  LEVEL_PASS,
  LEVEL_TEST_PER_LEVEL,
  parseSavedLevelTest,
  pickLevelTest,
  recommendMaterial,
  scoreLevelTest,
  type LevelTestSource,
} from "@/lib/level-test";

/** The level test (D109): pick, score, recommend. */
const s = (en: string, audio = true) => ({
  en,
  zh: "中文",
  audioUrl: audio ? `https://x/${en.length}.mp3` : null,
});
const sources: LevelTestSource[] = [
  {
    id: "p-b1",
    level: "beginner",
    sentences: [s("Hi."), s("Can I see your passport, please?")],
  },
  {
    id: "p-b2",
    level: "beginner",
    sentences: [s("Where is the train station from here?")],
  },
  {
    id: "p-b3",
    level: "beginner",
    sentences: [s("I would like a cup of coffee, please.")],
  },
  {
    id: "p-i1",
    level: "intermediate",
    sentences: [
      s(
        "The meeting has been moved to Thursday afternoon because the room is booked.",
      ),
    ],
  },
  {
    id: "p-i2",
    level: "intermediate",
    sentences: [
      s(
        "Could you send me the slides before the class starts tomorrow?",
        false,
      ),
      s("I think we should leave early so we can find a good seat."),
    ],
  },
  {
    id: "p-a1",
    level: "advanced",
    sentences: [
      s(
        "Researchers found that students who slept longer remembered significantly more of what they had studied the day before.",
      ),
    ],
  },
];

describe("picking the test", () => {
  const test = pickLevelTest(sources);

  it("takes a few fitting sentences with audio at each level, easy first", () => {
    expect(test.map((t) => t.level)).toEqual([
      "beginner",
      "beginner",
      "intermediate",
      "intermediate",
      "advanced",
    ]);
    expect(test.filter((t) => t.level === "beginner")).toHaveLength(
      LEVEL_TEST_PER_LEVEL,
    );
    // Too short ("Hi.") and silent sentences are skipped.
    expect(test[0].en).toBe("Can I see your passport, please?");
    expect(test[3].en).toBe(
      "I think we should leave early so we can find a good seat.",
    );
  });

  it("recommends a material at the level that the test didn't use", () => {
    expect(recommendMaterial(sources, "beginner", test)).toBe("p-b3");
    expect(recommendMaterial(sources, "advanced", test)).toBe("p-a1");
  });
});

describe("scoring", () => {
  const test = pickLevelTest(sources);

  it("suggests the hardest level passed in order", () => {
    const perfect = test.map((t) => t.en);
    expect(scoreLevelTest(test, perfect).level).toBe("advanced");
    const easyOnly = test.map((t, i) => (i < 2 ? t.en : "um"));
    const result = scoreLevelTest(test, easyOnly);
    expect(result.level).toBe("beginner");
    expect(result.scores.beginner).toBe(1);
    expect(result.scores.intermediate).toBeLessThan(LEVEL_PASS);
  });

  it("reaches a level at 60%, not below (D146)", () => {
    expect(LEVEL_PASS).toBe(0.6);
    // Intermediate sentences answered with about 60% of their words.
    const partly = (en: string, share: number) => {
      const words = en.split(" ");
      return words.slice(0, Math.ceil(words.length * share)).join(" ");
    };
    const at60 = test.map((t) =>
      t.level === "beginner"
        ? t.en
        : t.level === "intermediate"
          ? partly(t.en, 0.6)
          : "",
    );
    const reached = scoreLevelTest(test, at60);
    expect(reached.scores.intermediate).toBeGreaterThanOrEqual(0.6);
    expect(reached.level).toBe("intermediate");
    const at40 = test.map((t) =>
      t.level === "beginner"
        ? t.en
        : t.level === "intermediate"
          ? partly(t.en, 0.4)
          : "",
    );
    expect(scoreLevelTest(test, at40).level).toBe("beginner");
  });

  it("stops at the first level not passed", () => {
    const skipMiddle = test.map((t) =>
      t.level === "intermediate" ? "" : t.en,
    );
    expect(scoreLevelTest(test, skipMiddle).level).toBe("beginner");
  });

  it("is beginner even with nothing right", () => {
    expect(scoreLevelTest(test, []).level).toBe("beginner");
  });
});

describe("the saved result", () => {
  it("reads back only a valid one", () => {
    const saved = { level: "intermediate", scores: {}, date: "2026-11-11" };
    expect(parseSavedLevelTest(JSON.stringify(saved))).toEqual(saved);
    expect(parseSavedLevelTest('{"level":"expert"}')).toBeNull();
    expect(parseSavedLevelTest("nope")).toBeNull();
    expect(parseSavedLevelTest(null)).toBeNull();
  });
});
