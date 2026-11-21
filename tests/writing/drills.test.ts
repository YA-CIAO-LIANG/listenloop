import { describe, expect, it } from "vitest";
import { writingPrompts } from "@/data/writing";
import {
  checkCombine,
  checkFix,
  checkParaphrase,
  checkPattern,
  DRILL_DAYS,
  planDrills,
  rebuildAccuracy,
  reorderParagraph,
  shuffledOrder,
} from "@/lib/writing/drills";

describe("days 2–6 drills (D187)", () => {
  it("starts with the drills for the learner's weaknesses", () => {
    const plan = planDrills(["cohesion", "word-choice"], true);
    expect(plan[2]).toContain("reorder");
    expect(Object.values(plan).flat()).toContain("paraphrase");
  });

  it("gives 1–2 drills a day and never repeats a kind on consecutive days", () => {
    for (const weak of [
      [],
      ["grammar"],
      ["task", "tone", "sentence"],
    ] as const) {
      const plan = planDrills(weak, true);
      for (const day of DRILL_DAYS) {
        expect(plan[day].length).toBeGreaterThanOrEqual(1);
        expect(plan[day].length).toBeLessThanOrEqual(2);
        if (day > 2) {
          const yesterday = plan[(day - 1) as 2];
          expect(plan[day].filter((k) => yesterday.includes(k))).toEqual([]);
        }
      }
    }
  });

  it("leaves out fixing when there's nothing quoted to fix (guests)", () => {
    expect(Object.values(planDrills(["grammar"], false)).flat()).not.toContain(
      "fix",
    );
  });

  it("checks pattern imitation by rules", () => {
    const pattern = {
      keys: ["not only", "but", "also"],
      example: "Not only is the food cheap, but it is also delicious.",
    };
    expect(checkPattern("", pattern).reason).toBe("empty");
    expect(checkPattern("Not only fun.", pattern).reason).toBe("short");
    expect(
      checkPattern(
        "Not only is the food cheap, but it is also delicious.",
        pattern,
      ).reason,
    ).toBe("copied");
    expect(
      checkPattern("My city is big and very noisy at night.", pattern).reason,
    ).toBe("missingPattern");
    expect(
      checkPattern("Not only is my bike fast, but it is also light.", pattern)
        .ok,
    ).toBe(true);
  });

  it("checks combining and paraphrasing", () => {
    const drill = { parts: ["The food is cheap.", "The food is delicious."] };
    expect(
      checkCombine("The food is cheap. It is delicious.", drill).reason,
    ).toBe("notOneSentence");
    expect(checkCombine("The food is cheap and delicious.", drill).ok).toBe(
      true,
    );
    const sentence = {
      sentence: "A good weekend does not need to be expensive.",
    };
    expect(
      checkParaphrase("A good weekend does not need to be expensive.", sentence)
        .reason,
    ).toBe("same");
    expect(
      checkParaphrase(
        "You can have a great weekend without spending much.",
        sentence,
      ).ok,
    ).toBe(true);
  });

  it("checks a fix against the suggestion", () => {
    const issue = {
      quote: "He go to school.",
      suggestion: "He goes to school.",
    };
    expect(checkFix("He go to school.", issue).reason).toBe("same");
    expect(checkFix("He goes to school.", issue).ok).toBe(true);
  });

  it("rebuilds and reorders from the model", () => {
    expect(
      rebuildAccuracy(
        "We would talk about everything.",
        "We would talk about everything.",
      ),
    ).toBe(1);
    for (const prompt of writingPrompts) {
      const sentences = reorderParagraph(prompt);
      expect(sentences.length).toBeGreaterThanOrEqual(3);
      const order = shuffledOrder(sentences.length, prompt.id);
      expect(order).not.toEqual([...order].sort((a, b) => a - b));
      expect(shuffledOrder(sentences.length, prompt.id)).toEqual(order);
    }
  });
});

describe("fixing a mistake in its sentence (D191)", () => {
  it("shows the whole sentence and expects the suggestion in place", async () => {
    const { fixInContext } = await import("@/lib/writing/drills");
    const essay =
      "I like parks. On Saturday he go to the park with me. It is fun.";
    const c = fixInContext(essay, { quote: "he go", suggestion: "he goes" });
    expect(c.sentence).toBe("On Saturday he go to the park with me.");
    expect([c.before, c.quote, c.after]).toEqual([
      "On Saturday ",
      "he go",
      " to the park with me.",
    ]);
    expect(c.fixed).toBe("On Saturday he goes to the park with me.");
    expect(
      checkFix(c.fixed, { quote: c.sentence, suggestion: c.fixed }).ok,
    ).toBe(true);
    expect(fixInContext("x", { quote: "zz", suggestion: "yy" }).quote).toBe(
      "zz",
    );
  });
});
