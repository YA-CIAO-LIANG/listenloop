import { describe, expect, it } from "vitest";
import { prepareDraft } from "@/components/practice-generation";
import {
  isDialogue,
  parseSpeakerLine,
  speakerLines,
  withSpeakers,
} from "@/lib/custom-practice/speakers";

/** Two-voice dialogues (D57). */
describe("speaker labels", () => {
  it("labels a model's alternating lines", () => {
    expect(withSpeakers("Hi there.\nHello!\n\nHow are you?")).toBe(
      "A: Hi there.\nB: Hello!\nA: How are you?",
    );
  });

  it("reads A:, b:, and full-width colons, and leaves other lines alone", () => {
    expect(parseSpeakerLine("A: Hi.")).toEqual({ speaker: 0, text: "Hi." });
    expect(parseSpeakerLine(" b：Hello.")).toEqual({
      speaker: 1,
      text: "Hello.",
    });
    expect(parseSpeakerLine("At 9: we start.")).toEqual({
      speaker: null,
      text: "At 9: we start.",
    });
  });

  it("knows a dialogue by a B line", () => {
    expect(isDialogue(speakerLines("A: Hi.\nB: Hello."))).toBe(true);
    expect(isDialogue(speakerLines("A: Just me talking."))).toBe(false);
  });
});

describe("prepareDraft with speakers", () => {
  const translate = async (batch: string[]) => ({
    ok: true as const,
    translations: batch.map((line) => `[zh] ${line}`),
  });

  it("keeps each sentence's speaker, even when split by the rules", async () => {
    const result = await prepareDraft(
      {
        split: () => Promise.reject(new Error("offline")),
        translate,
      },
      "A: Hi there. How are you?\nB: I'm fine, thanks.",
      "en",
      () => {},
    );
    expect(result.ok && result.sentences).toEqual([
      { en: "Hi there.", zh: "[zh] Hi there.", speaker: 0 },
      { en: "How are you?", zh: "[zh] How are you?", speaker: 0 },
      { en: "I'm fine, thanks.", zh: "[zh] I'm fine, thanks.", speaker: 1 },
    ]);
  });
});
