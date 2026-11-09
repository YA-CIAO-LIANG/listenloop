import { describe, expect, it } from "vitest";
import { officialProblems, type OfficialCandidate } from "@/lib/official-check";

const sentences = [
  "We moved here last year.",
  "The city is quiet.",
  "I like it.",
];

/** Version 2 notes (D67) with one word, as a batch saves them. */
const notesFor = (en: string) => {
  const word = en.split(" ")[0].replace(/\W/g, "");
  return {
    v: 2,
    difficulty: "easy",
    highlights: [],
    vocab: [
      {
        term: word,
        inSentence: word,
        kind: "word",
        pos: "n.",
        zh: "詞",
        ipa: "",
        collocations: [],
        examples: [{ en: `${word} again.`, zh: "再一次。" }],
      },
    ],
    grammar: [],
    chunks: [],
    connected: [],
  };
};

async function candidate(): Promise<OfficialCandidate> {
  const notes = sentences.map(notesFor);
  return {
    titleEn: "Moving to a Quiet City",
    titleZh: "搬到安靜的城市",
    subtitle: "一個人談搬家後的生活",
    sentences: sentences.map((en, i) => ({
      en,
      zh: `第 ${i + 1} 句的翻譯。`,
      audioPath: `${i}.mp3`,
      notes: notes[i],
    })),
  };
}

describe("officialProblems (D99)", () => {
  it("passes a complete material", async () => {
    expect(officialProblems(await candidate())).toEqual([]);
  });

  it("names everything that's missing", async () => {
    const base = await candidate();
    expect(
      officialProblems({
        ...base,
        titleZh: "",
        subtitle: "字".repeat(61),
        sentences: [
          { ...base.sentences[0], zh: base.sentences[0].en },
          { ...base.sentences[1], audioPath: null },
          { ...base.sentences[2], notes: { v: 1 } },
        ],
      }),
    ).toEqual(["titleZh", "subtitle", "translation", "audio", "notes"]);
  });

  it("wants at least three sentences and an English title in English", async () => {
    const base = await candidate();
    expect(
      officialProblems({
        ...base,
        titleEn: "搬家",
        sentences: base.sentences.slice(0, 2),
      }),
    ).toEqual(["titleEn", "tooFewSentences"]);
  });
});

describe("officialProblems: the quality audit's problems (D117)", () => {
  it("finds full-width digits, names written two ways, and long notes", async () => {
    const base = await candidate();
    const long = {
      ...notesFor("Long"),
      vocab: [
        {
          ...notesFor("Long").vocab[0],
          zh: "很長的說明".repeat(300),
        },
      ],
    };
    expect(
      officialProblems({
        ...base,
        subtitle: "４號月台",
        sentences: [
          { ...base.sentences[0], en: "Hi, I'm Alex.", zh: "嗨，我是 Alex。" },
          { ...base.sentences[1], en: "Thanks, Alex.", zh: "謝了，亞歷克斯。" },
          { ...base.sentences[2], notes: long },
        ],
      }),
    ).toEqual(["fullWidth", "names", "longNotes"]);
  });
});

describe("officialProblems: a line that's only a name (D118)", () => {
  it("accepts the name as its translation", async () => {
    const base = await candidate();
    const sentences = [
      { ...base.sentences[0], en: "Emo?", zh: "Emo？" },
      { ...base.sentences[1], en: "Get up, Emo!", zh: "起來，Emo！" },
      base.sentences[2],
    ];
    expect(officialProblems({ ...base, sentences })).toEqual([]);
    // Any other line still needs Chinese.
    expect(
      officialProblems({
        ...base,
        sentences: [
          { ...sentences[0], en: "Hello?", zh: "Hello？" },
          ...sentences.slice(1),
        ],
      }),
    ).toEqual(["translation"]);
  });
});
