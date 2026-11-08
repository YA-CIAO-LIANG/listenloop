import { describe, expect, it } from "vitest";
import { reviseBudget } from "@/lib/ai/budgets";
import { fakeLanguage } from "@/lib/ai/fake";
import {
  checkRevision,
  parseRevisionRequest,
  reuseTranslations,
} from "@/lib/custom-practice/revise";

const request = {
  lines: ["We moved here.", "Do you like it?"],
  instruction: "換成更簡單的單字",
  format: "monologue",
};

describe("revise with an instruction (D96)", () => {
  it("takes an instruction of up to 200 characters and the draft's lines", () => {
    expect(parseRevisionRequest(request)).toEqual(request);
    for (const bad of [
      { ...request, instruction: " " },
      { ...request, instruction: "字".repeat(201) },
      { ...request, lines: [] },
      { ...request, lines: ["ok", 3] },
      { ...request, format: "poem" },
    ]) {
      expect(parseRevisionRequest(bad)).toBeNull();
    }
  });

  it("keeps the model's English lines, tidied", () => {
    expect(checkRevision({ lines: [" Hi  there. ", "", "好", 4] })).toEqual([
      "Hi there.",
    ]);
    expect(checkRevision({ lines: [] })).toBeNull();
    expect(checkRevision("no")).toBeNull();
  });

  it("keeps the translation of every unchanged sentence", () => {
    const before = [
      { en: "We moved here.", zh: "我們搬來這裡。" },
      { en: "Do you like it?", zh: "你喜歡嗎？" },
    ];
    expect(
      reuseTranslations(before, ["We moved here.", "Do you love it?"]),
    ).toEqual([
      { en: "We moved here.", zh: "我們搬來這裡。" },
      { en: "Do you love it?", zh: null },
    ]);
  });

  it("keeps speakers in a dialogue and alternates new turns", () => {
    const before = [
      { en: "Hi.", zh: "嗨。", speaker: 0 as const },
      { en: "Hello.", zh: "哈囉。", speaker: 1 as const },
    ];
    expect(reuseTranslations(before, ["Hi.", "Hey!", "Hello."])).toEqual([
      { en: "Hi.", zh: "嗨。", speaker: 0 },
      { en: "Hey!", zh: null, speaker: 1 },
      { en: "Hello.", zh: "哈囉。", speaker: 1 },
    ]);
  });

  it("budgets the call and the fake provider follows simple instructions", async () => {
    expect(reviseBudget(parseRevisionRequest(request)!)).toMatchObject({
      operation: "revise",
    });
    const shorter = await fakeLanguage.revise({
      ...request,
      format: "monologue",
      instruction: "縮短成 1 句",
    });
    expect(shorter.value).toEqual({ lines: ["We moved here."] });
    const other = await fakeLanguage.revise({
      ...request,
      format: "monologue",
    });
    expect(other.value).toEqual({
      lines: ["We moved here.", "Do you like it again."],
    });
  });
});
