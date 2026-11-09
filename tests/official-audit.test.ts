import { describe, expect, it } from "vitest";
import {
  auditSample,
  parseAudit,
  ruleIssues,
  type AuditMaterial,
} from "@/lib/official-audit";

/** The official materials' quality audit (D115). */
const notes = {
  v: 2,
  difficulty: "easy",
  highlights: [{ text: "station", note: "車站" }],
  vocab: [],
  grammar: [],
  chunks: [],
  connected: [],
};
const good: AuditMaterial = {
  id: "p-1",
  titleEn: "At the Station",
  titleZh: "在車站",
  subtitle: "在車站問路。",
  sentences: [
    {
      en: "The station is on the left.",
      zh: "車站在左邊。",
      audioPath: "a.mp3",
      notes,
    },
    {
      en: "Turn right at the bank.",
      zh: "在銀行右轉。",
      audioPath: "b.mp3",
      notes,
    },
  ],
};

describe("the rules", () => {
  it("find nothing in a complete material", () => {
    expect(ruleIssues(good)).toEqual([]);
  });

  it("find missing titles, translations, audio, and notes", () => {
    const broken: AuditMaterial = {
      ...good,
      titleEn: "車站",
      titleZh: "",
      subtitle: "x".repeat(61),
      sentences: [
        {
          en: "Hello there.",
          zh: "Hello there.",
          audioPath: null,
          notes: null,
        },
      ],
    };
    expect(ruleIssues(broken).map((i) => i.kind)).toEqual([
      "titleEn",
      "titleZh",
      "subtitle",
      "translation",
      "audio",
      "noNotes",
    ]);
  });

  it("find sentences too long to dictate, and notes too long to read", () => {
    const long = Array.from({ length: 32 }, (_, i) => `word${i}`).join(" ");
    const wordy = {
      ...notes,
      highlights: [{ text: "word1", note: "很長的說明".repeat(400) }],
    };
    const issues = ruleIssues({
      ...good,
      sentences: [
        { en: `${long}.`, zh: "很長的一句。", audioPath: "a", notes: wordy },
      ],
    });
    expect(issues).toContainEqual({
      kind: "longSentence",
      sentence: 0,
      detail: 32,
    });
    expect(issues.some((i) => i.kind === "longNotes")).toBe(true);
  });
});

describe("the AI sample", () => {
  it("spreads across the material and skips untranslated sentences", () => {
    const material = {
      ...good,
      sentences: Array.from({ length: 10 }, (_, i) => ({
        en: `Sentence ${i}.`,
        zh: i === 0 ? "" : `第 ${i} 句。`,
        audioPath: "a",
        notes,
      })),
    };
    expect(auditSample(material, 3)).toEqual([1, 5, 9]);
    expect(auditSample(good, 5)).toEqual([0, 1]);
  });

  it("reads each pair's verdict by its index, skipping garbled ones", () => {
    const verdicts = parseAudit(
      {
        items: [
          { i: 1, ok: false, issue: " 漏譯 " },
          { i: 0, ok: true, issue: "" },
          { i: 0, ok: false, issue: "duplicate" },
          { i: 7, ok: true, issue: "" },
          { i: 2, ok: "yes" },
        ],
      },
      3,
    );
    expect([...verdicts]).toEqual([
      [1, { ok: false, issue: "漏譯" }],
      [0, { ok: true, issue: "" }],
    ]);
    expect(parseAudit(null, 1).size).toBe(0);
  });
});

describe("ruleIssues: full-width and names (D117)", () => {
  it("flags full-width digits and a name translated where it's kept elsewhere", () => {
    const issues = ruleIssues({
      id: "m",
      titleEn: "Trains",
      titleZh: "火車",
      subtitle: "買車票",
      sentences: [
        {
          en: "Hi, I'm Alex.",
          zh: "嗨，我是 Alex。",
          audioPath: "a",
          notes: null,
        },
        {
          en: "Thanks, Alex.",
          zh: "謝謝，亞歷克斯，４號月台。",
          audioPath: "a",
          notes: null,
        },
      ],
    }).filter((i) => i.kind === "fullWidth" || i.kind === "name");
    expect(issues).toEqual([
      { kind: "fullWidth", sentence: 1 },
      { kind: "name", sentence: 1 },
    ]);
  });
});
