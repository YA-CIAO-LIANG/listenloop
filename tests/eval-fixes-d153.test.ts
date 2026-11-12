import { describe, expect, it, vi } from "vitest";
import {
  composeInstructions,
  NOTES_INSTRUCTIONS,
  notesInstructions,
  REVISE_INSTRUCTIONS,
  SEGMENT_INSTRUCTIONS,
  shortenInstruction,
} from "@/lib/ai/prompts";
import { LEVEL_PROMPTS } from "@/lib/categories";
import {
  guessedMeta,
  needsShortening,
  parseMaterialMeta,
  shortenedText,
  type CompositionPrompt,
  type GeneratedText,
  type GenerationRequest,
} from "@/lib/custom-practice/generation";
import { asInSentence, slashed } from "@/lib/custom-practice/rich-notes";
import { shortenIfLong, shortenRequest } from "@/lib/custom-practice/shorten";
import {
  checkedSegments,
  modelSegments,
  segmentsPerLine,
} from "@/lib/custom-practice/split";

/**
 * The fixes for what the first AI eval found (D153): written text twice
 * as long as asked, a 40-word sentence left whole, a Chinese split
 * returned per sentence instead of per line, an unrelated instruction
 * not refused, and notes too long. Plus the category AI files a text
 * under when the learner names none.
 */

const sentence = (n: number) =>
  `${Array.from({ length: n - 1 }, () => "word").join(" ")} end.`;

const text = (lines: string[]): GeneratedText => ({
  title: "Title",
  titleZh: "",
  subtitle: "",
  text: lines.join("\n"),
  category: null,
});

const prompt: CompositionPrompt = {
  topic: "",
  scenario: "at a coffee shop",
  level: LEVEL_PROMPTS.beginner,
  words: 100,
  format: "monologue",
};

describe("written text that comes out too long (D153)", () => {
  it("is too long only past 20% over the words asked for", () => {
    expect(needsShortening(sentence(10).repeat(1), 100)).toBe(false);
    const lines = (n: number) =>
      Array.from({ length: n }, () => sentence(10)).join("\n");
    expect(needsShortening(lines(12), 100)).toBe(false); // 120 words
    expect(needsShortening(lines(13), 100)).toBe(true); // 130 words
  });

  it("asks for the words wanted, as an edit of the same text", () => {
    const long = text(Array.from({ length: 20 }, () => sentence(10)));
    const request = shortenRequest(long, prompt);
    expect(request.lines).toHaveLength(20);
    expect(request.format).toBe("monologue");
    expect(request.instruction).toBe(shortenInstruction(100));
    expect(request.instruction).toMatch(/about 100 words/);
    expect(request.instruction).toMatch(/never more than 120/);
  });

  it("keeps the shorter text, with the first one's title", async () => {
    const long = text(Array.from({ length: 20 }, () => sentence(10)));
    const shorter = Array.from(
      { length: 10 },
      (_, i) => `Line ${i} ${sentence(8)}`,
    );
    const revise = vi.fn(async () => ({
      status: "changed",
      reason: "",
      lines: shorter,
    }));
    const result = await shortenIfLong(long, prompt, revise);
    expect(revise).toHaveBeenCalledOnce();
    expect(result.text).toBe(shorter.join("\n"));
    expect(result.title).toBe("Title");
  });

  it("doesn't call when the text fits", async () => {
    const fits = text(Array.from({ length: 10 }, () => sentence(10)));
    const revise = vi.fn();
    expect(await shortenIfLong(fits, prompt, revise)).toBe(fits);
    expect(revise).not.toHaveBeenCalled();
  });

  it("keeps the first text when shortening fails, refuses, or isn't shorter", async () => {
    const long = text(Array.from({ length: 20 }, () => sentence(10)));
    const failing = vi.fn(async () => {
      throw new Error("down");
    });
    expect(await shortenIfLong(long, prompt, failing)).toBe(long);
    const refusing = vi.fn(async () => ({
      status: "refused",
      reason: "no",
      lines: [],
    }));
    expect(await shortenIfLong(long, prompt, refusing)).toBe(long);
    expect(
      shortenedText(
        long,
        Array.from({ length: 25 }, () => sentence(10)),
        100,
      ),
    ).toBe(long);
    // Far too short to use (under 40% of the words asked for).
    expect(shortenedText(long, ["Hi there."], 100)).toBe(long);
  });
});

describe("the model's split (D153)", () => {
  it("takes one list per sentence when the pieces still make whole lines", () => {
    const lines = ["我昨天去圖書館借書。圖書館裡很安靜，大家都在讀書。"];
    const answer = [
      ["我昨天去圖書館借書。"],
      ["圖書館裡很安靜，大家都在讀書。"],
    ];
    expect(modelSegments(lines, answer)).toEqual([
      ["我昨天去圖書館借書。", "圖書館裡很安靜，大家都在讀書。"],
    ]);
    expect(checkedSegments(lines, answer, "zh")).toEqual(answer.flat());
  });

  it("matches pieces to several lines in order, and refuses a piece across lines", () => {
    const lines = ["One here. Two here.", "Three here."];
    expect(
      modelSegments(lines, [["One here."], ["Two here."], ["Three here."]]),
    ).toEqual([["One here.", "Two here."], ["Three here."]]);
    expect(
      modelSegments(lines, [["One here."], ["Two here. Three here."]]),
    ).toEqual([null, null]);
    expect(modelSegments(lines, [["One here. Two here."]])).toEqual([
      null,
      null,
    ]);
  });

  it("still checks each line on its own with one list per line", () => {
    const lines = ["A b c d e. F g h i j.", "K l m."];
    expect(
      modelSegments(lines, [["A b c d e.", "F g h i j."], ["changed"]]),
    ).toEqual([["A b c d e.", "F g h i j."], null]);
  });

  it("breaks an English piece over 25 words at a clause", () => {
    const long =
      "When I first moved to Taipei for university, I didn't know anyone in the city, so I joined the hiking club because I wanted to make friends and see the mountains around the city on weekends.";
    expect(segmentsPerLine([long], [[long]], "en")).toEqual([
      [
        "When I first moved to Taipei for university, I didn't know anyone in the city,",
        "so I joined the hiking club because I wanted to make friends and see the mountains around the city on weekends.",
      ],
    ]);
  });

  it("leaves Chinese pieces as the model cut them", () => {
    const line =
      "因為明天早上要考英文聽力，所以我今天晚上打算先把上週的單字複習一遍。";
    expect(segmentsPerLine([line], [[line]], "zh")).toEqual([[line]]);
  });
});

describe("the category AI files a text under (D153)", () => {
  const request: GenerationRequest = {
    topic: "",
    scenario: "",
    customScenario: "跟室友討論怎麼分攤電費",
    customCategory: "",
    titleEn: "",
    titleZh: "",
    level: "beginner",
    length: "1-2",
    format: "dialogue",
    accent: "us",
  };

  it("is the model's general category, with no scenario", () => {
    expect(guessedMeta(request, "money-admin")).toEqual({
      category: "money-admin",
      scenario: null,
      level: "beginner",
      exam: null,
      examTarget: null,
    });
  });

  it("is other when the model gave none, or exam", () => {
    expect(guessedMeta(request, null).category).toBe("other");
    expect(guessedMeta(request, "exam").category).toBe("other");
  });

  it("passes the server's check, which still refuses a mismatch", () => {
    const meta = guessedMeta(request, "health");
    expect(parseMaterialMeta(meta)).toEqual(meta);
    expect(parseMaterialMeta({ ...meta, category: "exam" })).toBeNull();
    expect(parseMaterialMeta({ ...meta, category: "nope" })).toBeNull();
    expect(parseMaterialMeta({ ...meta, exam: "toefl" })).toBeNull();
    expect(parseMaterialMeta({ ...meta, level: "expert" })).toBeNull();
  });
});

describe("the prompts' fixes (D153)", () => {
  it("gives every written text its length in words and sentences", () => {
    const instructions = composeInstructions({ words: 120 });
    expect(instructions).toMatch(/about 120 words in total/);
    expect(instructions).toMatch(/never more than 144/);
    expect(instructions).toMatch(/about 10 sentences/);
    expect(instructions).toMatch(/category/);
  });

  it("asks for one list per line, and no piece over 25 words", () => {
    expect(SEGMENT_INSTRUCTIONS("zh")).toMatch(/one list per input line/);
    expect(SEGMENT_INSTRUCTIONS("en")).toMatch(
      /No piece may be longer than 25/,
    );
    expect(SEGMENT_INSTRUCTIONS("zh")).toMatch(/2 or 3 pieces/);
  });

  it("refuses an instruction that isn't about this text", () => {
    expect(REVISE_INSTRUCTIONS).toMatch(/not about editing this text/);
  });

  it("caps each sentence's notes in the prompt", () => {
    const long =
      "Although the professor had explained the assignment twice, several students who had missed the first lecture still weren't sure whether they were supposed to submit a draft by Friday.";
    expect(notesInstructions([long])).toMatch(/under 800 characters/);
    const mixed = notesInstructions(["Could you turn off the lights?", long]);
    expect(mixed).toMatch(/Sentence 1 is longer than 25 words/);
    // Ordinary sentences keep the notes they had (the eval's recordings).
    expect(notesInstructions(["Could you turn off the lights?"])).toBe(
      NOTES_INSTRUCTIONS,
    );
  });
});

describe("quotes in notes (D153)", () => {
  it("joins punctuation the model spaced off back to its word", () => {
    const en = "Although he had explained it twice, they still asked.";
    expect(asInSentence("he had explained it twice ,", en)).toBe(
      "he had explained it twice,",
    );
    expect(asInSentence("they still asked .", en)).toBe("they still asked.");
    expect(asInSentence("twice, they", en)).toBe("twice, they");
    expect(asInSentence(null, en)).toBeNull();
  });
});

describe("IPA in notes (D153)", () => {
  it("adds a slash the model left off", () => {
    expect(slashed("/əˈsaɪnmənt")).toBe("/əˈsaɪnmənt/");
    expect(slashed("əˈsaɪnmənt/")).toBe("/əˈsaɪnmənt/");
    expect(slashed("/tɝn ɔf/")).toBe("/tɝn ɔf/");
    expect(slashed("")).toBe("");
  });
});
