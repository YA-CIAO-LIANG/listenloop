import { describe, expect, it } from "vitest";
import {
  choicesFor,
  compareSpelling,
  distractors,
  isQuizzable,
  misheardWords,
  pickQuizWords,
  QUIZ,
  quizAccuracy,
  quizCandidates,
  quizSummary,
  seededShuffle,
  spellingHint,
  type PoolWord,
} from "@/lib/vocab-quiz";
import type { RichNotes } from "@/lib/custom-practice/rich-notes";

const vocab = [
  {
    sentence: 2,
    word: "station",
    pos: "n.",
    zh: "車站",
    example: "The station is near.",
  },
  { sentence: 0, word: "the", pos: "art.", zh: "這", example: "" },
  {
    sentence: 1,
    word: "quiet",
    pos: "adj.",
    zh: "安靜的",
    example: "It was quiet.",
  },
  {
    sentence: 1,
    word: "look up",
    pos: "v.",
    zh: "查詢",
    example: "Look it up.",
  },
  { sentence: 3, word: "ok", pos: "adj.", zh: "好", example: "" },
  { sentence: 0, word: "moved", pos: "v.", zh: "搬家", example: "We moved." },
];

const rich: (RichNotes | null)[] = [
  {
    highlights: [],
    vocab: [
      {
        term: "move",
        inSentence: "moved",
        kind: "word",
        pos: "v.",
        zh: "搬家",
        ipa: "",
        collocations: [],
        examples: [{ en: "They moved to Tainan.", zh: "他們搬到台南。" }],
      },
      {
        term: "in time",
        inSentence: "in time",
        kind: "phrase",
        pos: "phr.",
        zh: "及時",
        ipa: "",
        collocations: [],
        examples: [],
      },
    ],
    grammar: [],
    chunks: [],
    connected: [],
  } as unknown as RichNotes,
];

describe("which words a quiz asks (D136)", () => {
  it("only single meaningful words with a part of speech and Chinese", () => {
    expect(isQuizzable("station")).toBe(true);
    expect(isQuizzable("don't")).toBe(true);
    expect(isQuizzable("the")).toBe(false);
    expect(isQuizzable("would")).toBe(false);
    expect(isQuizzable("look up")).toBe(false);
    expect(isQuizzable("ok")).toBe(false);
    const words = quizCandidates({ vocab, richNotes: rich });
    expect(words.map((w) => w.word)).toEqual([
      "move",
      "moved",
      "quiet",
      "station",
    ]);
    // Version 2 notes bring the example's Chinese and the form heard.
    expect(words[0]).toMatchObject({
      inSentence: "moved",
      example: { en: "They moved to Tainan.", zh: "他們搬到台南。" },
    });
    expect(words[2].example).toEqual({ en: "It was quiet." });
  });

  it("asks the misheard words first, then the rest, up to the maximum", () => {
    const words = quizCandidates({ vocab });
    const missed = misheardWords(
      [
        { en: "We moved here." },
        { en: "It was quiet." },
        { en: "The station is near." },
      ],
      ["we move here", "it was quite", null],
    );
    expect([...missed]).toEqual(["moved", "quiet"]);
    // Misheard first (in sentence order), then the rest.
    expect(
      pickQuizWords(words, new Set(["station"])).map((w) => w.word),
    ).toEqual(["station", "moved", "quiet"]);
    expect(pickQuizWords(words, missed).map((w) => w.word)).toEqual([
      "moved",
      "quiet",
      "station",
    ]);
    // A misheard form (moved) finds its base form (move) through the notes.
    const richWords = quizCandidates({ vocab: [], richNotes: rich });
    expect(pickQuizWords(richWords, new Set(["moved"]))[0].word).toBe("move");
    const many = Array.from({ length: 15 }, (_, i) => ({
      word: `word${"x".repeat(i)}`,
      pos: "n.",
      zh: `字${i}`,
      sentence: i,
    }));
    expect(pickQuizWords(many, new Set())).toHaveLength(QUIZ.max);
  });
});

describe("wrong answers (D136)", () => {
  const target: PoolWord = { word: "station", pos: "n.", zh: "車站" };
  const material: PoolWord[] = [
    target,
    { word: "ticket", pos: "n.", zh: "票" },
    { word: "platform", pos: "n", zh: "月台" },
    { word: "quiet", pos: "adj.", zh: "安靜的" },
    { word: "stop", pos: "n.", zh: "車站" },
  ];
  const others: PoolWord[] = [
    { word: "garden", pos: "n.", zh: "花園" },
    { word: "run", pos: "v.", zh: "跑" },
  ];

  it("come from this material's same part of speech first, never the answer", () => {
    const wrong = distractors(target, material, others);
    expect(wrong).toHaveLength(3);
    expect(wrong.slice(0, 2).sort()).toEqual(["月台", "票"]);
    expect(wrong).not.toContain("車站");
    expect(new Set(wrong).size).toBe(3);
  });

  it("fill up from other materials, and stay the same each time", () => {
    const small = [target, { word: "ticket", pos: "n.", zh: "票" }];
    const wrong = distractors(target, small, others);
    expect(wrong).toEqual(["票", ...wrong.slice(1)]);
    expect(wrong).toContain("花園");
    expect(distractors(target, small, others)).toEqual(wrong);
    const choices = choicesFor(target, wrong);
    expect(choices).toHaveLength(4);
    expect(choices).toContain("車站");
    expect(choicesFor(target, wrong)).toEqual(choices);
    expect(seededShuffle([1, 2, 3], "a")).toEqual(
      seededShuffle([1, 2, 3], "a"),
    );
  });
});

describe("spelling (D136)", () => {
  it("ignores case and spaces at the ends", () => {
    expect(compareSpelling("Station", "  station ").correct).toBe(true);
    expect(compareSpelling("don't", "don’t").correct).toBe(true);
    expect(compareSpelling("station", "").correct).toBe(false);
  });

  it("marks each letter: a wrong one, a missing one, an extra one", () => {
    const kinds = (word: string, typed: string) =>
      compareSpelling(word, typed)
        .marks.map((m) => `${m.char}:${m.kind[0]}`)
        .join(" ");
    expect(kinds("quiet", "quite")).toBe("q:r u:r i:r e:w t:w");
    expect(kinds("station", "staton")).toBe("s:r t:r a:r t:r i:m o:r n:r");
    expect(kinds("cat", "cart")).toBe("c:r a:r r:e t:r");
  });

  it("hints the number of letters, then the first letter", () => {
    expect(spellingHint("quiet", 0)).toBeNull();
    expect(spellingHint("quiet", 1)).toBe("_ _ _ _ _");
    expect(spellingHint("quiet", 2)).toBe("q _ _ _ _");
    expect(spellingHint("don't", 1)).toBe("_ _ _ ' _");
  });
});

describe("results (D136)", () => {
  it("counts each step and the hints, and lists what was missed", () => {
    const summary = quizSummary([
      { word: "quiet", spelled: true, hints: 0, translated: true },
      { word: "station", spelled: false, hints: 2, translated: true },
      { word: "moved", spelled: true, hints: 1, translated: false },
    ]);
    expect(summary).toEqual({
      total: 3,
      spelled: 2,
      translated: 2,
      hints: 3,
      missed: ["station", "moved"],
    });
    expect(quizAccuracy(summary)).toBeCloseTo(4 / 6);
    expect(quizAccuracy({ total: 0, spelled: 0, translated: 0 })).toBe(0);
  });
});

describe("quiz misses go on the review list (D136)", () => {
  it("as the form in their sentence, and only when it's there", async () => {
    const { quizMisses } = await import("@/lib/vocab-quiz");
    const words = [
      { word: "move", inSentence: "moved", pos: "v.", zh: "搬家", sentence: 0 },
      { word: "quiet", pos: "adj.", zh: "安靜的", sentence: 1 },
      { word: "garden", pos: "n.", zh: "花園", sentence: 1 },
    ];
    const misses = quizMisses(words, ["move", "garden", "quiet"], {
      id: "p-x",
      sentences: [
        { en: "We moved here.", zh: "我們搬來這裡。" },
        { en: "It was quiet.", zh: "很安靜。" },
      ],
      audioUrls: ["a.mp3", "b.mp3"],
    });
    expect(misses).toEqual([
      {
        en: "We moved here.",
        zh: "我們搬來這裡。",
        videoId: "p-x",
        i: 0,
        word: "moved",
        audio: "a.mp3",
      },
      {
        en: "It was quiet.",
        zh: "很安靜。",
        videoId: "p-x",
        i: 1,
        word: "quiet",
        audio: "b.mp3",
      },
    ]);
  });
});
