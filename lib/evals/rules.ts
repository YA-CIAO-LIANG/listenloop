import { hasFullWidth, textLength } from "@/lib/content-fixes";
import type { RichNotes } from "@/lib/custom-practice/rich-notes";
import { shownAnswer, type Processed } from "./pipeline";
import type { EvalCase, Rule, RuleResult } from "./types";

/**
 * The checks a rule can make on its own (D150): lengths, formats,
 * half-width digits, titles kept, sentence counts. Each says why it
 * failed, in Chinese, for the report.
 */

/** Simplified characters common enough to show up in a bad translation. */
const SIMPLIFIED =
  /[们这说时会为国学对发么个门车东见号电话语读书买卖还让给头实现过应关机开网软视频]/;

/** Mainland words where Taiwan says it differently (臺灣用語). */
const MAINLAND_WORDS = [
  "軟件",
  "視頻",
  "出租車",
  "公交",
  "信息",
  "網絡",
  "打印",
  "屏幕",
  "短信",
  "默認",
  "質量",
  "激活",
  "硬盤",
  "博客",
  "地鐵站",
];

/** The rules each step's answers can be checked by. */
export const RULES_FOR: Record<EvalCase["operation"], readonly Rule["kind"][]> =
  {
    translate: ["sameLineCount", "namesKept", "taiwanUsage", "includes"],
    segment: ["modelSplitKept", "pieceCount", "keptWhole", "pieceWordsMax"],
    annotate: [
      "notesMaxChars",
      "rawNotesMaxChars",
      "quotesInSentence",
      "ipaSlashes",
      "hasVocab",
      "noReduction",
    ],
    compose: [
      "wordsWithin",
      "sentenceWords",
      "noSpeakerLabels",
      "titleExact",
      "subtitleMax",
      "mentions",
    ],
    describe: ["subtitleMax", "noOpening", "titleExact"],
    revise: ["status", "changedShare", "lineCount", "hasReason"],
  };

const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

/** Every string in a value, for checks over the whole answer. */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (typeof value === "object" && value !== null) {
    return Object.values(value).flatMap(strings);
  }
  return [];
}

const pass = (rule: Rule, detail = ""): RuleResult => ({
  kind: rule.kind,
  pass: true,
  detail,
});
const fail = (rule: Rule, detail: string): RuleResult => ({
  kind: rule.kind,
  pass: false,
  detail,
});
const check = (rule: Rule, ok: boolean, why: string): RuleResult =>
  ok ? pass(rule) : fail(rule, why);

const notApplicable = (rule: Rule, operation: string) =>
  fail(rule, `規則 ${rule.kind} 不適用於 ${operation}（測試集設定錯誤）`);

/** Every quoted span of one sentence's notes, which must be in it. */
function quotes(notes: RichNotes): string[] {
  return [
    ...notes.highlights.map((h) => h.text),
    ...notes.vocab.map((v) => v.inSentence),
    ...notes.grammar.map((g) => g.quote),
    ...notes.chunks.map((c) => c.text),
    ...notes.connected.map((c) => c.text),
  ].filter(Boolean);
}

/** Whether the case's processed answer is usable at all. */
function usable(processed: Processed): boolean {
  switch (processed.operation) {
    case "translate":
      return processed.lines !== null;
    case "segment":
      return processed.pieces.length > 0;
    case "annotate":
      return processed.rawChars.every((n) => n > 0);
    case "compose":
      return processed.text !== null;
    case "describe":
      return processed.subtitle !== null;
    case "revise":
      return processed.revision !== null;
  }
}

export function checkRule(
  evalCase: EvalCase,
  processed: Processed,
  rule: Rule,
): RuleResult {
  if (rule.kind === "valid") {
    return check(rule, usable(processed), "答案無法使用（被程式的檢查擋下）");
  }
  if (rule.kind === "noFullWidth") {
    const bad = strings(shownAnswer(processed)).filter(hasFullWidth);
    return check(rule, bad.length === 0, `有全形英數字：${bad[0] ?? ""}`);
  }

  if (
    evalCase.operation === "translate" &&
    processed.operation === "translate"
  ) {
    const lines = processed.lines ?? [];
    const source = evalCase.input.lines;
    switch (rule.kind) {
      case "sameLineCount":
        return check(
          rule,
          lines.length === source.length,
          `行數 ${lines.length}，應為 ${source.length}`,
        );
      case "namesKept": {
        for (const name of rule.names) {
          for (const [i, line] of source.entries()) {
            if (line.includes(name) && !lines[i]?.includes(name)) {
              return fail(
                rule,
                `第 ${i + 1} 行沒有保留人名「${name}」：${lines[i] ?? ""}`,
              );
            }
          }
        }
        return pass(rule);
      }
      case "taiwanUsage": {
        const text = lines.join("\n");
        const simplified = SIMPLIFIED.exec(text)?.[0];
        if (simplified) return fail(rule, `有簡體字「${simplified}」`);
        const word = MAINLAND_WORDS.find((w) => text.includes(w));
        return check(rule, !word, `用了大陸用語「${word}」`);
      }
      case "includes": {
        const line = lines[rule.line] ?? "";
        return check(
          rule,
          rule.anyOf.some((text) => line.includes(text)),
          `第 ${rule.line + 1} 行應包含「${rule.anyOf.join("／")}」：${line}`,
        );
      }
    }
  }

  if (evalCase.operation === "segment" && processed.operation === "segment") {
    const { pieces } = processed;
    switch (rule.kind) {
      case "modelSplitKept":
        return check(
          rule,
          processed.modelKept,
          "模型改動了原文或跨行，改用規則斷句",
        );
      case "pieceCount":
        return check(
          rule,
          pieces.length >= rule.min && pieces.length <= rule.max,
          `切成 ${pieces.length} 句，應為 ${rule.min}～${rule.max} 句`,
        );
      case "keptWhole": {
        const cut = rule.texts.find(
          (text) => !pieces.some((piece) => piece.includes(text)),
        );
        return check(rule, !cut, `「${cut}」被切開了`);
      }
      case "pieceWordsMax": {
        const long = pieces.find((piece) => words(piece) > rule.max);
        return check(rule, !long, `超過 ${rule.max} 字：${long}`);
      }
    }
  }

  if (evalCase.operation === "annotate" && processed.operation === "annotate") {
    const { sentences } = evalCase.input;
    const { notes } = processed;
    switch (rule.kind) {
      case "notesMaxChars": {
        const i = notes.findIndex((n) => textLength(n) > rule.max);
        return check(
          rule,
          i === -1,
          `第 ${i + 1} 句講解 ${i === -1 ? 0 : textLength(notes[i])} 字，超過 ${rule.max} 字`,
        );
      }
      case "rawNotesMaxChars": {
        const i = processed.rawChars.findIndex((n) => n > rule.max);
        return check(
          rule,
          i === -1,
          `模型寫的第 ${i + 1} 句講解 ${processed.rawChars[i] ?? 0} 字，超過 ${rule.max} 字（程式會截短，內容變少）`,
        );
      }
      case "quotesInSentence": {
        for (const [i, n] of notes.entries()) {
          const sentence = sentences[i].toLowerCase();
          const outside = quotes(n).find(
            (q) => !sentence.includes(q.toLowerCase()),
          );
          if (outside)
            return fail(rule, `第 ${i + 1} 句的引文不在原句：${outside}`);
        }
        return pass(rule);
      }
      case "ipaSlashes": {
        const bad = notes
          .flatMap((n) => n.vocab)
          .find((v) => v.kind === "word" && !/^\/.+\/$/.test(v.ipa));
        return check(rule, !bad, `「${bad?.term}」的音標格式不對：${bad?.ipa}`);
      }
      case "hasVocab": {
        const i = notes.findIndex((n) => n.vocab.length === 0);
        return check(rule, i === -1, `第 ${i + 1} 句沒有單字講解`);
      }
      case "noReduction": {
        const bad = notes
          .flatMap((n) => n.connected)
          .find((c) =>
            rule.soundsLike.some((s) =>
              c.soundsLike.toLowerCase().includes(s.toLowerCase()),
            ),
          );
        return check(
          rule,
          !bad,
          `錯誤的連音：${bad?.text} → ${bad?.soundsLike}`,
        );
      }
    }
  }

  if (evalCase.operation === "compose" && processed.operation === "compose") {
    const text = processed.text;
    if (!text) return fail(rule, "沒有可用的文字");
    const lines = text.text.split("\n");
    switch (rule.kind) {
      case "wordsWithin": {
        const asked = evalCase.input.words;
        const got = words(text.text);
        return check(
          rule,
          Math.abs(got - asked) <= asked * rule.ratio,
          `${got} 字，要求 ${asked} 字（±${Math.round(rule.ratio * 100)}%）`,
        );
      }
      case "sentenceWords": {
        const fit = lines.filter((line) => {
          const n = words(line);
          return n >= rule.min && n <= rule.max;
        }).length;
        return check(
          rule,
          fit / lines.length >= rule.share,
          `${fit}/${lines.length} 行在 ${rule.min}～${rule.max} 字之間`,
        );
      }
      case "noSpeakerLabels": {
        const labeled = lines.find((line) =>
          /^[A-Z][\w .'-]{0,20}:\s/.test(line),
        );
        return check(rule, !labeled, `有說話者標籤：${labeled}`);
      }
      case "titleExact":
        return check(
          rule,
          (rule.en === undefined || text.title === rule.en) &&
            (rule.zh === undefined || text.titleZh === rule.zh),
          `標題被改了：${text.title}／${text.titleZh}`,
        );
      case "subtitleMax":
        return check(
          rule,
          text.subtitle !== "" && [...text.subtitle].length <= rule.max,
          `副標「${text.subtitle}」不是 1～${rule.max} 字`,
        );
      case "mentions": {
        const lower = text.text.toLowerCase();
        return check(
          rule,
          rule.anyOf.some((word) => lower.includes(word.toLowerCase())),
          `內容沒有提到「${rule.anyOf.join("／")}」`,
        );
      }
    }
  }

  if (evalCase.operation === "describe" && processed.operation === "describe") {
    const subtitle = processed.subtitle ?? "";
    switch (rule.kind) {
      case "subtitleMax":
        return check(
          rule,
          subtitle !== "" && [...subtitle].length <= rule.max,
          `副標「${subtitle}」不是 1～${rule.max} 字`,
        );
      case "noOpening": {
        const opening = rule.words.find((w) => subtitle.startsWith(w));
        return check(rule, !opening, `副標以「${opening}」開頭`);
      }
      case "titleExact":
        return check(
          rule,
          (rule.en === undefined || processed.titleEn === rule.en) &&
            (rule.zh === undefined || processed.titleZh === rule.zh),
          `標題被改了：${processed.titleEn}／${processed.titleZh}`,
        );
    }
  }

  if (evalCase.operation === "revise" && processed.operation === "revise") {
    const revision = processed.revision;
    if (!revision) return fail(rule, "答案無法使用");
    const before = evalCase.input.lines;
    switch (rule.kind) {
      case "status":
        return check(
          rule,
          revision.status === rule.is,
          `結果是 ${revision.status}，應為 ${rule.is}`,
        );
      case "changedShare": {
        if (revision.status !== "changed") {
          return fail(rule, `沒有改（${revision.status}）`);
        }
        const kept = new Set(before);
        const changed = revision.lines.filter((line) => !kept.has(line)).length;
        return check(
          rule,
          changed / revision.lines.length >= rule.atLeast,
          `只改了 ${changed}/${revision.lines.length} 句，應至少 ${Math.round(rule.atLeast * 100)}%`,
        );
      }
      case "lineCount": {
        const after =
          revision.status === "changed" ? revision.lines.length : before.length;
        const ok =
          rule.compared === "fewer"
            ? after < before.length
            : after > before.length;
        return check(
          rule,
          ok,
          `句數 ${before.length} → ${after}，應該${rule.compared === "fewer" ? "變少" : "變多"}`,
        );
      }
      case "hasReason":
        return check(
          rule,
          revision.status !== "changed" && revision.reason.trim() !== "",
          "沒有說明原因",
        );
    }
  }

  return notApplicable(rule, evalCase.operation);
}

export function checkRules(
  evalCase: EvalCase,
  processed: Processed,
): RuleResult[] {
  return evalCase.rules.map((rule) => checkRule(evalCase, processed, rule));
}
