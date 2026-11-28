import { describe, expect, it } from "vitest";
import { gradeLevel, syllables } from "@/lib/writing/readability";
import {
  cleanRewrite,
  essaySentences,
  versionParagraphs,
} from "@/lib/writing/rewrite/clean";
import { fakeRewrite } from "@/lib/writing/rewrite/fake";
import {
  checkCase,
  replayRewrite,
  retention,
  rewriteBaseline,
  rewriteInputOf,
  runRewriteCase,
  MissingRewriteRecording,
  type RewriteTransport,
} from "@/lib/writing/rewrite/eval";
import { REWRITE_GOLDEN } from "@/lib/writing/rewrite/golden";
import {
  addVersion,
  chooseVersion,
  chosenVersion,
  parseRewrite,
  shownVersion,
  versionsLeft,
} from "@/lib/writing/rewrite/state";
import {
  MAX_REWRITE_VERSIONS,
  type RewriteVersion,
} from "@/lib/writing/rewrite/types";
import {
  backTranslationItems,
  extraBackItems,
  needsPracticeChoice,
  rewritePool,
} from "@/lib/writing/back-translation";
import { parseWritingSettings } from "@/lib/writing/settings";
import { REWRITE_SCHEMA } from "@/lib/writing/rewrite/prompts";

const ESSAY =
  "My weekend is simple. On Saturday I goed to the park.\nShe very like flowers. We eat a apple and talk.";

describe("essay sentences (D218)", () => {
  it("splits by paragraph and sentence, keeping Dr. and numbers", () => {
    expect(essaySentences(ESSAY)).toEqual([
      { i: 0, p: 0, en: "My weekend is simple." },
      { i: 1, p: 0, en: "On Saturday I goed to the park." },
      { i: 2, p: 1, en: "She very like flowers." },
      { i: 3, p: 1, en: "We eat a apple and talk." },
    ]);
    expect(
      essaySentences("I saw Dr. Lin at 3 p.m. today. It was 2.5 km away."),
    ).toHaveLength(2);
    expect(essaySentences("   \n\n  ")).toEqual([]);
  });
});

describe("readability (D218)", () => {
  it("counts syllables roughly", () => {
    expect(syllables("cat")).toBe(1);
    expect(syllables("table")).toBe(2);
    expect(syllables("beautiful")).toBe(3);
    expect(syllables("communication")).toBeGreaterThanOrEqual(4);
  });

  it("reads longer words and sentences as harder", () => {
    const easy = gradeLevel("I like my cat. It is big. We play.");
    const hard = gradeLevel(
      "Nevertheless, considerable environmental deterioration necessitates comprehensive international cooperation.",
    );
    expect(hard).toBeGreaterThan(easy + 5);
    expect(gradeLevel("")).toBe(0);
  });
});

const input = {
  sentences: essaySentences(ESSAY).map(({ i, en }) => ({ i, en })),
};
const paragraphs = new Map(essaySentences(ESSAY).map((s) => [s.i, s.p]));

describe("cleaning the model's rewrite (D218)", () => {
  it("keeps one sentence per sentence sent, with reasons only for changes", () => {
    const cleaned = cleanRewrite(
      {
        declined: "none",
        items: [
          {
            i: 0,
            revised: "My weekend is simple.",
            why: "沒改",
            zh: "我的週末很簡單。",
          },
          {
            i: 1,
            revised: "On Saturday I went to the park.",
            why: "goed 要改成 went。",
            zh: "星期六我去了公園。",
          },
          {
            i: 2,
            revised: "She really likes flowers.",
            why: "Fixed it",
            zh: "",
          },
          { i: 99, revised: "Extra.", why: "", zh: "" },
        ],
      },
      input,
      paragraphs,
    );
    expect(cleaned.ok).toBe(true);
    if (!cleaned.ok) return;
    expect(cleaned.sentences.map((s) => s.revised)).toEqual([
      "My weekend is simple.",
      "On Saturday I went to the park.",
      "She really likes flowers.",
      "We eat a apple and talk.",
    ]);
    // Unchanged: no reason; English reason dropped; missing kept as written.
    expect(cleaned.sentences[0]).toMatchObject({ changed: false, why: "" });
    expect(cleaned.sentences[1]).toMatchObject({
      changed: true,
      why: "goed 要改成 went。",
      p: 0,
    });
    expect(cleaned.sentences[2]).toMatchObject({ why: "", zh: "", p: 1 });
    expect(cleaned.missing).toEqual([3]);
    expect(cleaned.grade).toBeGreaterThan(-5);
  });

  it("drops a revision that adds a lot (a new essay), and passes declines on", () => {
    const long = Array.from({ length: 40 }, () => "dogs").join(" ");
    const cleaned = cleanRewrite(
      {
        declined: "none",
        items: [
          { i: 0, revised: long, why: "", zh: "" },
          { i: 1, revised: "On Saturday I went to the park.", why: "", zh: "" },
        ],
      },
      input,
      paragraphs,
    );
    expect(cleaned.ok && cleaned.sentences[0].revised).toBe(
      "My weekend is simple.",
    );
    expect(
      cleanRewrite({ declined: "ghostwrite", items: [] }, input, paragraphs),
    ).toEqual({ ok: false, declined: "ghostwrite" });
    expect(cleanRewrite(null, input, paragraphs)).toEqual({ ok: false });
    expect(cleanRewrite({ items: [] }, input, paragraphs)).toEqual({
      ok: false,
    });
  });

  it("joins a version back into paragraphs", () => {
    expect(
      versionParagraphs([
        { p: 0, revised: "A." },
        { p: 0, revised: "B." },
        { p: 1, revised: "C." },
      ]),
    ).toEqual(["A. B.", "C."]);
  });

  it("has a strict schema", () => {
    expect(REWRITE_SCHEMA.required).toEqual(["declined", "items"]);
  });
});

const version = (id: string, extra: Partial<RewriteVersion> = {}) =>
  ({
    id,
    level: "natural",
    sentences: essaySentences(ESSAY).map(({ i, p, en }) => ({
      i,
      p,
      original: en,
      revised: i === 1 ? "On Saturday I went to the park." : en,
      changed: i === 1,
      why: i === 1 ? "時態" : "",
      zh: `第 ${i} 句`,
    })),
    grade: 2,
    at: "2026-11-27T00:00:00.000Z",
    ...extra,
  }) as RewriteVersion;

describe("rewrite versions (D218)", () => {
  it("adds, chooses, shows, and limits versions", () => {
    let r = addVersion(undefined, ESSAY, version("a"));
    r = addVersion(r, ESSAY, version("b", { level: "fix" }));
    expect(shownVersion(r, null)?.id).toBe("b");
    r = chooseVersion(r, "a")!;
    expect(shownVersion(r, null)?.id).toBe("a");
    expect(shownVersion(r, "b")?.id).toBe("b");
    expect(chooseVersion(r, "nope")).toBe(r);
    expect(versionsLeft(r)).toBe(MAX_REWRITE_VERSIONS - 2);
    expect(chosenVersion({ essay: ESSAY, rewrite: r })?.id).toBe("a");
    // Day 1 written again: the old versions don't count.
    expect(chosenVersion({ essay: "Another essay.", rewrite: r })).toBe(
      undefined,
    );
    const fresh = addVersion(r, "Another essay.", version("c"));
    expect(fresh.versions.map((v) => v.id)).toEqual(["c"]);
    expect(fresh.chosen).toBeUndefined();
  });

  it("parses what's stored, dropping what isn't a version", () => {
    const parsed = parseRewrite({
      essay: ESSAY,
      versions: [version("a"), { id: "x" }, "junk"],
      chosen: "x",
    });
    expect(parsed?.versions.map((v) => v.id)).toEqual(["a"]);
    expect(parsed?.chosen).toBeUndefined();
    expect(parseRewrite(null)).toBeUndefined();
  });

  it("remembers the default level in the writing settings", () => {
    expect(parseWritingSettings({}).rewriteLevel).toBe("natural");
    expect(parseWritingSettings({ rewriteLevel: "fix" }).rewriteLevel).toBe(
      "fix",
    );
    expect(parseWritingSettings({ rewriteLevel: "x" }).rewriteLevel).toBe(
      "natural",
    );
  });
});

const prompt = {
  model: {
    en: ["The model essay has one sentence here. And another one is here."],
    zh: ["範文這裡有一句。這裡還有另一句。"],
  },
  patterns: [],
};

describe("Days 2–6 practice the chosen version (D218)", () => {
  const rewrite = chooseVersion(
    addVersion(undefined, ESSAY, version("a")),
    "a",
  );
  const day1 = { essay: ESSAY, rewrite };

  it("uses the chosen version, changed sentences first, with the meaning", () => {
    const pool = rewritePool(day1)!;
    expect(pool[0]).toEqual({
      en: "On Saturday I went to the park.",
      zh: "第 1 句",
      source: "fix",
    });
    expect(pool.map((i) => i.en)).not.toContain(
      "The model essay has one sentence here.",
    );
    const items = backTranslationItems({ prompt, day1, day: 2 });
    expect(items[0].en).toBe("On Saturday I went to the park.");
    expect(items.every((i) => i.source !== "model")).toBe(true);
    expect(
      extraBackItems({ prompt, day1, day: 2, round: 1, exclude: [] }).every(
        (i) => i.source !== "model",
      ),
    ).toBe(true);
  });

  it("uses the model essay when the learner chose it", () => {
    const items = backTranslationItems({
      prompt,
      day1: { essay: ESSAY, source: "model" },
      day: 2,
    });
    expect(items.map((i) => i.source)).toEqual(["model", "model"]);
  });

  it("asks for a choice before Day 2, but not mid-week", () => {
    expect(needsPracticeChoice({ essay: ESSAY }, {})).toBe(true);
    expect(needsPracticeChoice(day1, {})).toBe(false);
    expect(needsPracticeChoice({ essay: ESSAY, source: "model" }, {})).toBe(
      false,
    );
    // A week begun before D218 goes on as it was.
    expect(
      needsPracticeChoice({ essay: ESSAY }, { 2: { back: { items: [] } } }),
    ).toBe(false);
  });
});

/** The fake provider behind an Azure-shaped answer (no API). */
const fakeTransport: RewriteTransport = async (_id, body) => {
  const request = body as { messages: { role: string; content: string }[] };
  const user = JSON.parse(
    request.messages.find((m) => m.role === "user")!.content,
  );
  return {
    status: 200,
    response: {
      choices: [
        {
          finish_reason: "stop",
          message: { content: JSON.stringify(fakeRewrite(user)) },
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 100 },
    },
  };
};

describe("the rewrite eval (D218)", () => {
  it("has golden cases with the essays' meaning words in them", () => {
    expect(REWRITE_GOLDEN.length).toBeGreaterThanOrEqual(10);
    for (const c of REWRITE_GOLDEN) {
      for (const k of c.keep) {
        expect(
          k.split("|").some((a) => c.essay.toLowerCase().includes(a)),
          `${c.id}: ${k}`,
        ).toBe(true);
      }
      for (const e of c.errors ?? []) {
        expect(c.essay.toLowerCase(), `${c.id}: ${e}`).toContain(e);
      }
      const n = essaySentences(c.essay).length;
      for (const i of c.correct ?? []) expect(i).toBeLessThan(n);
    }
  });

  it("runs every call through the provider code and scores it", async () => {
    const c = REWRITE_GOLDEN.find((x) => x.id === "weekend-grandma")!;
    const result = await runRewriteCase(c, fakeTransport);
    const rules = new Set(result.rules.map((r) => r.rule));
    for (const rule of [
      "valid",
      "meaning",
      "fixed",
      "own-words",
      "closest",
      "harder",
      "easier",
      "stepped-up",
      "no-additions",
      "explained",
    ]) {
      expect(rules, rule).toContain(rule);
    }
    // The fake fixes "goed", "very like", "a apple".
    expect(
      result.rules.filter((r) => r.rule === "fixed").every((r) => r.ok),
    ).toBe(true);
    expect(result.rules.find((r) => r.rule === "own-words")?.ok).toBe(true);
    const baseline = rewriteBaseline([result]);
    expect(baseline.version).toMatch(/^r\d+-/);
    expect(baseline.cases["weekend-grandma"]).toBe(result.score);
  });

  it("catches a version that lost the meaning or kept an error", () => {
    const c = REWRITE_GOLDEN[0];
    const sentences = essaySentences(c.essay).map(({ i, p, en }) => ({
      i,
      p,
      original: en,
      revised: en.replace(/grandmother/, "friend"),
      changed: /grandmother/.test(en),
      why: /grandmother/.test(en) ? "改了" : "",
      zh: "中文",
    }));
    const version = { ok: true as const, sentences, grade: 3, missing: [] };
    const rules = checkCase(c, { fix: version });
    expect(rules.find((r) => r.rule === "meaning")?.ok).toBe(false);
    expect(rules.find((r) => r.rule === "fixed")?.ok).toBe(false);
  });

  it("measures how many of the learner's words a sentence keeps", () => {
    expect(retention("I goed to the park", "I went to the park")).toBe(0.8);
    expect(retention("", "x")).toBe(1);
  });

  it("asks easier and harder from the version shown", () => {
    const c = REWRITE_GOLDEN[0];
    const current = [{ i: 0, en: "x" }];
    const adjusted = rewriteInputOf(c, "natural", "easier", current);
    // The version shown is what's rewritten; the learner's own for meaning.
    expect(adjusted).toMatchObject({
      level: "natural",
      adjust: "easier",
      sentences: current,
      learner: "beginner",
    });
    expect(adjusted.original?.[0].en).toBe(essaySentences(c.essay)[0].en);
    expect(rewriteInputOf(c, "fix")).not.toHaveProperty("adjust");
  });

  it("refuses to score without a recording for the request", async () => {
    const replay = replayRewrite(() => null);
    await expect(
      runRewriteCase(REWRITE_GOLDEN[0], replay),
    ).rejects.toBeInstanceOf(MissingRewriteRecording);
  });
});
