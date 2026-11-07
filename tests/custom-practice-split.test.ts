import { describe, expect, it } from "vitest";
import {
  checkedSegments,
  detectTextLanguage,
  SENTENCE_WORDS,
  splitLong,
  splitSentences,
  textLines,
} from "@/lib/custom-practice/split";
import { NEWS_SENTENCES, NEWS_TEXT } from "./news-text";

describe("splitSentences: the news text (D49)", () => {
  it("keeps curly apostrophes and skips the blank line", () => {
    expect(NEWS_TEXT).toContain("Party’s");
    expect(NEWS_TEXT).toContain("\n\n");
    expect(splitSentences(NEWS_TEXT, "en")).toEqual(NEWS_SENTENCES);
    expect(splitSentences(NEWS_TEXT.replace(/\n/g, "\r\n"), "en")).toEqual(
      NEWS_SENTENCES,
    );
  });
});

describe("splitSentences: English", () => {
  it("splits after . ! ? when the next sentence starts with a capital", () => {
    expect(
      splitSentences(
        "We moved here. Do you like it? Yes! 3 cats live here.",
        "en",
      ),
    ).toEqual([
      "We moved here.",
      "Do you like it?",
      "Yes!",
      "3 cats live here.",
    ]);
  });

  it("keeps abbreviations, initials, decimals, and times together", () => {
    expect(
      splitSentences(
        "Mr. Smith paid $3.50 at 9 a.m. today. J. K. Rowling met Dr. Lee in the U.S. last year.",
        "en",
      ),
    ).toEqual([
      "Mr. Smith paid $3.50 at 9 a.m. today.",
      "J. K. Rowling met Dr. Lee in the U.S. last year.",
    ]);
  });

  it("keeps closing quotes with the sentence and doesn't break before lowercase", () => {
    expect(
      splitSentences('"Really?" she asked. "Yes." He nodded...', "en"),
    ).toEqual(['"Really?" she asked.', '"Yes."', "He nodded..."]);
  });

  it("treats every line as its own block and drops empty or symbol-only lines", () => {
    expect(
      splitSentences(
        "A: Hi there\r\n\r\nB: Hello\n  ---  \nC:   how   are you",
        "en",
      ),
    ).toEqual(["A: Hi there", "B: Hello", "C: how are you"]);
  });
});

describe("splitSentences: Chinese", () => {
  it("splits after full-width punctuation, keeping closing quotes", () => {
    expect(
      splitSentences(
        "我們搬到城市了。你呢？「好啊！」他說。今天，天氣很好",
        "zh",
      ),
    ).toEqual([
      "我們搬到城市了。",
      "你呢？",
      "「好啊！」",
      "他說。",
      "今天，天氣很好",
    ]);
  });

  it("splits on semicolons and ellipses, not commas", () => {
    expect(splitSentences("先吃飯；再出門……好嗎，可以", "zh")).toEqual([
      "先吃飯；",
      "再出門……",
      "好嗎，可以",
    ]);
  });
});

describe("detectTextLanguage", () => {
  it.each([
    ["我們搬到城市了。", "zh"],
    ["Hello, world.", "en"],
    ["I learned the word 你好 today in class.", "en"],
    ["今天學了 apple 這個字", "zh"],
    ["123 !!!", "en"],
  ] as const)("%j is %s", (text, language) => {
    expect(detectTextLanguage(text)).toBe(language);
  });
});

/**
 * Hard cases for splitting (e+ 4): what a good split looks like. The
 * language model is asked for these; the rules below must at least never
 * cut inside them, and a model answer that changes the text is refused.
 */
const HARD = {
  abbreviations:
    'Dr. Smith arrived at 9:30 a.m. in the U.S. He said, "It\'s 90% done." Then he left.',
  amounts:
    "The Ph.D. program costs $3.5 million, e.g. for labs. No. 5 is next.",
  ellipsis: "Wait... did he forget something? I think so.",
  quote: '"Stop!" she shouted. "We\'re not done yet," he replied.',
  longSentence:
    "We spent the whole afternoon walking around the old part of the city looking for the little bookshop, but we could not find it anywhere because the street names had all been changed.",
  dialogue:
    "A: Excuse me, where is the station?\nB: Go straight and turn left at the bank.",
  chinese: "他說：「我們明天見！」然後就走了。你覺得呢？",
};

describe("hard sentences", () => {
  it("never cuts inside abbreviations, times, or percents", () => {
    // "U.S. He" is ambiguous to the rules; the model splits it (below).
    expect(splitSentences(HARD.abbreviations, "en")).toEqual([
      'Dr. Smith arrived at 9:30 a.m. in the U.S. He said, "It\'s 90% done."',
      "Then he left.",
    ]);
  });

  it("keeps amounts, degrees, and numbered items whole", () => {
    expect(splitSentences(HARD.amounts, "en")).toEqual([
      "The Ph.D. program costs $3.5 million, e.g. for labs.",
      "No. 5 is next.",
    ]);
  });

  it("handles ellipses, quotes, and dialogue lines", () => {
    expect(splitSentences(HARD.ellipsis, "en")).toEqual([
      "Wait... did he forget something?",
      "I think so.",
    ]);
    expect(splitSentences(HARD.quote, "en")).toEqual([
      '"Stop!" she shouted.',
      '"We\'re not done yet," he replied.',
    ]);
    expect(splitSentences(HARD.dialogue, "en")).toEqual([
      "A: Excuse me, where is the station?",
      "B: Go straight and turn left at the bank.",
    ]);
  });

  it("keeps Chinese quotes with what introduces them", () => {
    expect(splitSentences(HARD.chinese, "zh")).toEqual([
      "他說：「我們明天見！」",
      "然後就走了。",
      "你覺得呢？",
    ]);
  });

  it(`breaks sentences over ${SENTENCE_WORDS.max} words at a clause boundary`, () => {
    const parts = splitSentences(HARD.longSentence, "en");
    expect(parts).toEqual([
      "We spent the whole afternoon walking around the old part of the city looking for the little bookshop,",
      "but we could not find it anywhere because the street names had all been changed.",
    ]);
    for (const part of parts) {
      expect(part.split(" ").length).toBeLessThanOrEqual(SENTENCE_WORDS.max);
    }
  });

  it("leaves a long sentence whole when no clause boundary keeps both parts long enough", () => {
    const sentence = Array(30).fill("word").join(" ") + ".";
    expect(splitLong(sentence)).toEqual([sentence]);
    expect(splitLong("Short, and fine.")).toEqual(["Short, and fine."]);
  });
});

describe("checkedSegments", () => {
  const lines = textLines(HARD.abbreviations + "\n" + HARD.ellipsis);

  it("takes the model's split when it only cut the text", () => {
    expect(
      checkedSegments(
        lines,
        [
          [
            "Dr. Smith arrived at 9:30 a.m. in the U.S.",
            'He said, "It\'s 90% done." Then he left.',
          ],
          ["Wait... did he forget something?", " I think so. "],
        ],
        "en",
      ),
    ).toEqual([
      "Dr. Smith arrived at 9:30 a.m. in the U.S.",
      'He said, "It\'s 90% done." Then he left.',
      "Wait... did he forget something?",
      "I think so.",
    ]);
  });

  it("splits a line by the rules when the model changed, dropped, or added text", () => {
    const rules = splitSentences(HARD.ellipsis, "en");
    for (const changed of [
      ["Wait, did he forget something?", "I think so."],
      ["Wait... did he forget something?"],
      ["Wait... did he forget something?", "I think so.", "Yes."],
      [],
      "not a list",
    ]) {
      expect(
        checkedSegments([lines[1]], [changed], "en"),
        JSON.stringify(changed),
      ).toEqual(rules);
    }
  });

  it("falls back for every line when the answer doesn't match the lines", () => {
    expect(checkedSegments(lines, [["one"]], "en")).toEqual(
      splitSentences(lines.join("\n"), "en"),
    );
    expect(checkedSegments(lines, null, "en")).toHaveLength(4);
  });
});
