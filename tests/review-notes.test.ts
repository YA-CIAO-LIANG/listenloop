import { describe, expect, it } from "vitest";
import type { RichNotes } from "@/lib/custom-practice/rich-notes";
import { reviewNote } from "@/lib/review-notes";

/** A misheard word's notes in the review (D145). */
const rich = (vocab: unknown[]) =>
  ({
    highlights: [],
    vocab,
    grammar: [],
    chunks: [],
    connected: [],
  }) as unknown as RichNotes;

const moved = {
  term: "move",
  inSentence: "moved",
  kind: "word",
  pos: "v.",
  zh: "搬家",
  ipa: "/muːv/",
  collocations: [],
  examples: [{ en: "They moved to Tainan.", zh: "他們搬到台南。" }],
};

describe("reviewNote", () => {
  it("finds the form heard in the sentence, with its sound and example", () => {
    expect(
      reviewNote({ vocab: [], richNotes: [rich([moved])] }, "Moved", 0),
    ).toEqual({
      term: "move",
      pos: "v.",
      zh: "搬家",
      ipa: "/muːv/",
      example: { en: "They moved to Tainan.", zh: "他們搬到台南。" },
    });
  });

  it("matches the base form, a word inside a phrase, then this sentence first", () => {
    const material = {
      vocab: [],
      richNotes: [
        rich([{ ...moved, zh: "移動", inSentence: "move" }]),
        rich([
          {
            ...moved,
            term: "turn right",
            inSentence: "Turn right",
            kind: "phrase",
            zh: "右轉",
          },
          moved,
        ]),
      ],
    };
    expect(reviewNote(material, "move", 1)?.zh).toBe("搬家");
    expect(reviewNote(material, "move", 0)?.zh).toBe("移動");
  });

  it("falls back to the first-format notes, without IPA", () => {
    expect(
      reviewNote(
        {
          vocab: [
            {
              sentence: 2,
              word: "station",
              pos: "n.",
              zh: "車站",
              example: "The station is near.",
            },
          ],
        },
        "station",
        2,
      ),
    ).toEqual({
      term: "station",
      pos: "n.",
      zh: "車站",
      example: { en: "The station is near." },
    });
  });

  it("is null when the notes don't have the word", () => {
    expect(reviewNote({ vocab: [] }, "station")).toBeNull();
  });
});
