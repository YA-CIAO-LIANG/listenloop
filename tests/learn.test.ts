import { describe, expect, it } from "vitest";
import { isLearnCategory, LEARN_CATEGORIES, learnPath } from "@/lib/learn";
import { practiceRobots } from "@/lib/practice-material";
import en from "@/messages/en.json";
import zh from "@/messages/zh-Hant.json";

/** Topic landing pages (D116). */
describe("topic pages", () => {
  it("cover every category but the learner's own", () => {
    expect(LEARN_CATEGORIES).toContain("study-abroad");
    expect(LEARN_CATEGORIES).toContain("exam");
    expect(isLearnCategory("other")).toBe(false);
    expect(isLearnCategory("nope")).toBe(false);
    expect(learnPath("travel")).toBe("/learn/travel");
  });

  it("have an introduction in both languages", () => {
    for (const id of LEARN_CATEGORIES) {
      expect(zh.learn.intros[id], id).toBeTruthy();
      expect(en.learn.intros[id], id).toBeTruthy();
    }
  });
});

describe("indexing", () => {
  const material = {
    id: "p-1",
    title: "t",
    sentences: [],
    vocab: [],
    grammar: [],
    audioUrls: [],
  };
  it("lets search engines index official materials, not learners' own", () => {
    expect(practiceRobots({ ...material, official: true })).toEqual({});
    expect(practiceRobots(material)).toEqual({
      robots: { index: false, follow: false },
    });
  });
});
