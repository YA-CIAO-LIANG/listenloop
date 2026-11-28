import { describe, expect, it } from "vitest";
import {
  checkCloze,
  clozeBlanks,
  DEFAULT_DAY_FORMATS,
  formatItems,
  parseDayFormats,
  PARAGRAPH_SENTENCES,
  wrongBefore,
} from "@/lib/writing/day-formats";
import {
  newRun,
  answerRun,
  runSummary,
  type BackRun,
} from "@/lib/writing/back-translation";
import { dayPercent } from "@/lib/writing/log";
import { DEFAULT_PLAYBACK, parsePlayback } from "@/lib/playback";
import { PERSONAL_SETTING_KEYS } from "@/lib/personal-settings";
import { parseWritingSettings } from "@/lib/writing/settings";
import type { RewriteVersion } from "@/lib/writing/rewrite/types";

const sentence = (
  i: number,
  p: number,
  original: string,
  revised = original,
) => ({
  i,
  p,
  original,
  revised,
  changed: original !== revised,
  why: original !== revised ? "改了" : "",
  zh: `中文 ${i}`,
});

const version: RewriteVersion = {
  id: "v",
  level: "natural",
  grade: 3,
  at: "2026-11-27T00:00:00.000Z",
  sentences: [
    sentence(0, 0, "My weekend is very simple and quiet."),
    sentence(
      1,
      0,
      "On Saturday I goed to the park.",
      "On Saturday I went to the park.",
    ),
    sentence(
      2,
      0,
      "She very like the flowers there.",
      "She really likes the flowers there.",
    ),
    sentence(3, 0, "We sit on a bench for an hour."),
    sentence(4, 0, "Then we walk home slowly together."),
    sentence(5, 1, "On Sunday I stay at home all day."),
    sentence(6, 1, "I read comic books and draw pictures."),
  ],
};
const essay = version.sentences.map((s) => s.original).join(" ");
const day1 = { essay, rewrite: { essay, versions: [version], chosen: "v" } };
const prompt = {
  model: { en: ["A model one. A model two."], zh: ["一。二。"] },
};

describe("days 2–6 formats (D219)", () => {
  it("defaults to Joe's order and reads stored choices", () => {
    expect(DEFAULT_DAY_FORMATS).toEqual({
      2: "listen-read",
      3: "cloze",
      4: "hints",
      5: "zh-en",
      6: "paragraph",
    });
    expect(parseDayFormats({ 4: "zh-en", 5: "nope" })).toEqual({
      ...DEFAULT_DAY_FORMATS,
      4: "zh-en",
    });
    expect(parseWritingSettings({}).formats).toEqual(DEFAULT_DAY_FORMATS);
  });

  it("takes the chosen version's sentences, changed ones first, with the learner's original", () => {
    const items = formatItems({
      prompt,
      day1,
      day: 2,
      format: "listen-read",
      days: {},
    });
    expect(items.slice(0, 2).map((i) => i.en)).toEqual([
      "On Saturday I went to the park.",
      "She really likes the flowers there.",
    ]);
    expect(items[0].original).toBe("On Saturday I goed to the park.");
    expect(items[0].zh).toBe("中文 1");
    expect(items.some((i) => i.source === "model")).toBe(false);
  });

  it("puts yesterday's wrong sentences first", () => {
    const run = newRun(
      formatItems({ prompt, day1, day: 3, format: "cloze", days: {} }),
    );
    const wrongIndex = run.items.findIndex(
      (i) => i.en === "I read comic books and draw pictures.",
    );
    const answered = answerRun(run, wrongIndex, {
      mode: "listen-write",
      score: 0,
      right: false,
      answer: "x",
    });
    const days = { 3: { back: answered } };
    expect([...wrongBefore(days, 4)]).toEqual([
      "i read comic books and draw pictures",
    ]);
    const next = formatItems({ prompt, day1, day: 4, format: "hints", days });
    expect(next[0].en).toBe("I read comic books and draw pictures.");
  });

  it("makes paragraphs of at most four sentences", () => {
    const items = formatItems({
      prompt,
      day1,
      day: 6,
      format: "paragraph",
      days: {},
    });
    expect(items.map((i) => i.parts?.length)).toEqual([
      PARAGRAPH_SENTENCES,
      1,
      2,
    ]);
    expect(items[0].en).toBe(
      "My weekend is very simple and quiet. On Saturday I went to the park. She really likes the flowers there. We sit on a bench for an hour.",
    );
    expect(items[0].zh).toBe("中文 0中文 1中文 2中文 3");
  });

  it("uses the model essay when chosen instead", () => {
    const items = formatItems({
      prompt: {
        model: {
          en: [
            "The model essay has a first sentence. And it has a second one.",
          ],
          zh: ["範文第一句。範文第二句。"],
        },
      },
      day1: { essay, source: "model" },
      day: 2,
      format: "listen-read",
      days: {},
    });
    expect(items.map((i) => i.source)).toEqual(["model", "model"]);
  });
});

describe("cloze (D219)", () => {
  it("hides the changed words first, 1 to 3 by length", () => {
    const item = {
      en: "She really likes the flowers there.",
      original: "She very like the flowers there.",
    };
    const blanks = clozeBlanks(item);
    expect(blanks).toHaveLength(1);
    expect(item.en.split(" ")[blanks[0]]).toMatch(/really|likes/);
    expect(
      clozeBlanks({
        en: "In the summer of 2024, my family and I traveled to Tainan for three days by train.",
      }),
    ).toHaveLength(3);
    // No small words.
    const words = "It is in the box.".split(" ");
    for (const b of clozeBlanks({ en: "It is in the box." })) {
      expect(["It", "is", "in", "the"]).not.toContain(words[b]);
    }
  });

  it("checks each blank, case and punctuation aside", () => {
    const en = "She really likes the flowers there.";
    expect(checkCloze(en, [1, 4], ["Really", "flowers"])).toEqual({
      right: [true, true],
      score: 1,
    });
    expect(checkCloze(en, [1, 4], ["very", "flowers"]).score).toBe(0.5);
  });
});

describe("listen and read has no accuracy (D219)", () => {
  it("counts seen sentences apart from answers", () => {
    let run: BackRun = {
      ...newRun([{ en: "A b c.", source: "own" }]),
      format: "listen-read",
    };
    run = answerRun(run, 0, {
      mode: "listen-write",
      score: 1,
      right: true,
      answer: "",
      viewed: true,
    });
    expect(runSummary(run)).toMatchObject({ answered: 0, percent: 0 });
    expect(dayPercent(2, { done: true, back: run } as never)).toBeNull();
  });
});

describe("playback settings (D220)", () => {
  it("reads what's stored, the defaults otherwise", () => {
    expect(parsePlayback(null)).toEqual(DEFAULT_PLAYBACK);
    expect(parsePlayback("{bad")).toEqual(DEFAULT_PLAYBACK);
    expect(
      parsePlayback(
        JSON.stringify({
          repeats: 3,
          gap: 3,
          speed: 0.75,
          autoplay: false,
          voice: "male",
          loop: true,
        }),
      ),
    ).toEqual({
      repeats: 3,
      gap: 3,
      speed: 0.75,
      autoplay: false,
      voice: "male",
      loop: true,
    });
    expect(parsePlayback(JSON.stringify({ repeats: 9, speed: 2 }))).toEqual(
      DEFAULT_PLAYBACK,
    );
  });

  it("is a personal setting, so it follows the account", () => {
    expect(PERSONAL_SETTING_KEYS).toContain("ll-playback:v1");
  });
});
