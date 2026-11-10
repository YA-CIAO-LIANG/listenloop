import { describe, expect, it } from "vitest";
import { reviseBudget } from "@/lib/ai/budgets";
import { fakeLanguage } from "@/lib/ai/fake";
import {
  checkRevision,
  parseRevisionRequest,
  reuseTranslations,
  revisionOutcome,
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
    expect(
      checkRevision(
        { status: "changed", lines: [" Hi  there. ", "", "好", 4] },
        request.lines,
      ),
    ).toEqual({ status: "changed", lines: ["Hi there."] });
    expect(checkRevision({ lines: [] }, request.lines)).toBeNull();
    expect(checkRevision("no", request.lines)).toBeNull();
  });

  it("never reports the same text as a change: that was '0 of 7 changed' (D123)", () => {
    expect(
      checkRevision(
        { status: "changed", reason: "", lines: [...request.lines] },
        request.lines,
      ),
    ).toEqual({ status: "unchanged", reason: "" });
    // The D96 answer had no status; the same lines still mean unchanged.
    expect(checkRevision({ lines: request.lines }, request.lines)).toEqual({
      status: "unchanged",
      reason: "",
    });
    expect(revisionOutcome({ lines: request.lines }, request.lines)).toBe(
      "unchanged",
    );
  });

  it("passes on the model's reason for refusing or changing nothing", () => {
    expect(
      checkRevision(
        { status: "refused", reason: " 不適合 \n 學生 ", lines: [] },
        request.lines,
      ),
    ).toEqual({ status: "refused", reason: "不適合 學生" });
    expect(
      checkRevision(
        { status: "unchanged", reason: "字".repeat(300), lines: [] },
        request.lines,
      ),
    ).toEqual({ status: "unchanged", reason: "字".repeat(200) });
    expect(revisionOutcome({ status: "refused" }, request.lines)).toBe(
      "refused",
    );
    expect(revisionOutcome("nonsense", request.lines)).toBe("invalid");
  });

  it("counts changed sentences for the usage log, including a new count", () => {
    expect(
      revisionOutcome(
        {
          status: "changed",
          lines: ["We moved here.", "It was dark.", "Then it rained."],
        },
        request.lines,
      ),
    ).toBe("changed 2/3");
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
    expect(shorter.value).toMatchObject({
      status: "changed",
      lines: ["We moved here."],
    });
    const other = await fakeLanguage.revise({
      ...request,
      format: "monologue",
    });
    expect(other.value).toMatchObject({
      lines: ["We moved here.", "Do you like it again."],
    });
  });

  it("the fake provider rewrites a style into more sentences, and fails on cue (D123)", async () => {
    const input = { ...request, format: "monologue" as const };
    const style = await fakeLanguage.revise({
      ...input,
      instruction: "改成恐怖風",
    });
    expect(checkRevision(style.value, request.lines)).toEqual({
      status: "changed",
      lines: [
        "We moved here, in the dark.",
        "Do you like it, in the dark.",
        "Then the lights went out.",
      ],
    });
    expect(
      (await fakeLanguage.revise({ ...input, instruction: "不用改" })).value,
    ).toMatchObject({ status: "unchanged" });
    expect(
      (await fakeLanguage.revise({ ...input, instruction: "危險" })).value,
    ).toMatchObject({ status: "refused" });
    await expect(
      fakeLanguage.revise({ ...input, instruction: "過濾" }),
    ).rejects.toMatchObject({ code: "filtered" });
    await expect(
      fakeLanguage.revise({ ...input, instruction: "壞掉" }),
    ).rejects.toMatchObject({ code: "failed" });
  });
});
