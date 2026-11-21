import { RUBRICS } from "./rubrics";
import type { WritingReviewInput } from "./prompts";

/**
 * The fake provider's writing feedback (D187): deterministic, from simple
 * rules on the essay, in the model's answer format. Development, tests,
 * and E2E use it; it never calls an API. Its findings are real enough to
 * walk the whole flow: highlighted quotes are words of the essay.
 */
const GHOSTWRITE =
  /(write (it|this|the essay|an essay) for me|幫我寫|代寫|ghostwrite)/i;

type Finding = { quote: string; type: string; why: string; suggestion: string };

const RULES: {
  test: RegExp;
  type: string;
  why: string;
  fix: (m: string) => string;
}[] = [
  {
    test: /\b(he|she|it) (go|want|like|have|do)\b/i,
    type: "verb",
    why: "第三人稱單數的現在式動詞要加 -s（或用 has、does）。",
    fix: (m) =>
      m
        .replace(/\b(go|do)$/i, "$1es")
        .replace(/\bhave$/i, "has")
        .replace(/\b(want|like)$/i, "$1s"),
  },
  {
    test: /\ba (apple|hour|honest|umbrella|interesting|important|old|exam|idea|English)\b/i,
    type: "article",
    why: "母音開頭的字前面要用 an，不是 a。",
    fix: (m) => m.replace(/^a /i, "an "),
  },
  {
    test: /(?:^|[.!?]\s+)i [a-z]+/,
    type: "grammar",
    why: "代名詞 I 一律大寫。",
    fix: (m) => m.replace(/^i /, "I "),
  },
  {
    test: /\bvery like\b/i,
    type: "word-choice",
    why: "like 不能用 very 修飾，要說 really like 或 like … very much。",
    fix: () => "really like",
  },
  {
    test: /\bin the weekend\b/i,
    type: "preposition",
    why: "「在週末」美式英文用 on the weekend（英式用 at the weekend）。",
    fix: () => "on the weekend",
  },
  {
    test: /\b(because|so) [^.!?]*\. (Because|So) /,
    type: "sentence",
    why: "Because 或 So 開頭的半句不能單獨成句，要和前一句合併。",
    fix: (m) =>
      m.replace(/\. (Because|So) /, (_x, w: string) => `, ${w.toLowerCase()} `),
  },
];

const LINKERS =
  /\b(however|therefore|because|first|finally|in addition|for example|although|moreover|in conclusion)\b/gi;

export function fakeWritingReview(input: WritingReviewInput) {
  const essay = input.essay;
  const words = essay.split(/\s+/).filter((w) => /[A-Za-z]/.test(w)).length;
  const rubric = RUBRICS[input.rubric];
  const empty = (declined: string, summary: string) => ({
    declined,
    criteria: rubric.criteria.map((c) => ({ id: c.id, score: 0, reason: "" })),
    issues: [],
    more: [],
    strengths: [],
    summary,
  });
  if (GHOSTWRITE.test(essay)) {
    return empty(
      "ghostwrite",
      "這次沒有評分：WritingLoop 不會幫你寫整篇文章。先用自己的話寫一個版本，哪怕很短，回饋才能幫你一步步改進。",
    );
  }
  if (words < 20) {
    return empty(
      "too-short",
      "文章少於 20 個英文字，還沒辦法評分。先試著寫完整幾句，再送出。",
    );
  }

  const findings: Finding[] = [];
  for (const rule of RULES) {
    const match = essay.match(rule.test);
    if (!match) continue;
    const quote = match[0].replace(/^[.!?]\s+/, "").trim();
    findings.push({
      quote,
      type: rule.type,
      why: rule.why,
      suggestion: rule.fix(quote),
    });
  }
  const linkers = new Set(
    (essay.match(LINKERS) ?? []).map((w) => w.toLowerCase()),
  ).size;
  if (linkers < 2) {
    const first =
      essay.split(/(?<=[.!?])\s+/)[1] ?? essay.split(/(?<=[.!?])\s+/)[0];
    findings.push({
      quote: first.trim(),
      type: "cohesion",
      why: "句子之間少了轉折詞，讀起來像清單。試著用 First、In addition、However 連接想法。",
      suggestion: `In addition, ${first.trim().replace(/^[A-Z]/, (c) => c.toLowerCase())}`,
    });
  }
  const paragraphs = essay.split(/\n\s*\n/).filter((p) => p.trim()).length;
  const short = words < input.words.min;

  // Simple, stable scores: start high, take off for what was found.
  const base = (max: number) => Math.round(max * 0.8 * 2) / 2;
  const scores: Record<string, number> = {};
  const [taskId, orgId, vocabId, grammarId] = rubric.criteria.map((c) => c.id);
  const max = rubric.criteria[0].max;
  const step = rubric.criteria[0].step;
  const cut = (value: number, by: number) =>
    Math.max(step, Math.round((value - by) / step) * step);
  scores[taskId] = cut(base(max), short ? max * 0.3 : 0);
  scores[orgId] = cut(
    base(max),
    (linkers < 2 ? max * 0.2 : 0) + (paragraphs < 2 ? max * 0.1 : 0),
  );
  scores[vocabId] = cut(
    base(max),
    findings.some((f) => f.type === "word-choice") ? max * 0.2 : 0,
  );
  const grammarErrors = findings.filter((f) =>
    ["verb", "article", "grammar", "preposition", "sentence"].includes(f.type),
  ).length;
  scores[grammarId] = cut(base(max), grammarErrors * max * 0.1);

  const reasons: Record<string, string> = {
    [taskId]: short
      ? `文章有 ${words} 個字，少於建議的 ${input.words.min} 字，內容還不夠完整。`
      : `文章有 ${words} 個字，回答了題目的主要部分。`,
    [orgId]:
      linkers < 2
        ? "段落之間的轉折詞不多，想法的順序不夠清楚。"
        : `用了 ${linkers} 種轉折詞，順序清楚。`,
    [vocabId]: "用字大致正確，可以再多用幾個題目相關的字詞。",
    [grammarId]: grammarErrors
      ? `有 ${grammarErrors} 處文法問題，見下方標示。`
      : "沒有發現明顯的文法錯誤。",
  };
  const firstSentence = essay.split(/(?<=[.!?])\s+/)[0].trim();
  return {
    declined: "none",
    criteria: rubric.criteria.map((c) => ({
      id: c.id,
      score: scores[c.id],
      reason: reasons[c.id],
    })),
    issues: findings.slice(0, 3),
    more: findings.slice(3),
    strengths: [
      {
        quote: firstSentence.slice(0, 120),
        why: "開頭直接回應題目，讀者一看就知道你要寫什麼。",
      },
    ],
    summary: findings.length
      ? "整體意思清楚。先把標示的三個問題改好，再練習用轉折詞把句子串起來。"
      : "寫得很好！接下來試著用更多樣的句型，讓文章更有層次。",
  };
}
