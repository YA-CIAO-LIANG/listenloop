import { azureOpenAiLanguage } from "@/lib/ai/azure-openai";
import { EVAL_MODEL } from "@/lib/evals/config";
import { requestHash, type EvalException } from "@/lib/evals/run";
import { normalizeWords } from "@/lib/scoring/normalize";
import { gradeLevel } from "../readability";
import { cleanRewrite, essaySentences, type CleanRewrite } from "./clean";
import type { RewriteEvalCase } from "./golden";
import { REWRITE_PROMPT_VERSION } from "./prompts";
import type { RewriteAdjust, RewriteInput, RewriteLevel } from "./types";

/**
 * The essay-rewrite eval (D218): every golden essay rewritten at the
 * three levels (and some a step easier and harder than "natural")
 * through the production provider code and cleaning, from recordings
 * (free) or the real API (recording, with Joe's go-ahead), then checked
 * by rules:
 * - valid: every sentence came back;
 * - meaning: the words that carry the meaning are all still there;
 * - fixed: the known errors are gone ("fix" and "natural");
 * - own-words: "fix" keeps the learner's words (each sentence ≥ 60% of
 *   its words, ≥ 80% on average) and leaves correct sentences alone;
 * - closest: "fix" keeps more of the learner's words than "natural",
 *   and "natural" more than "advanced";
 * - harder: "advanced" reads harder than "fix" and "natural"
 *   (Flesch–Kincaid grade);
 * - easier / stepped-up: "too hard" comes back easier than what was
 *   shown, "a bit harder" harder (by at least 0.3 grade);
 * - no-additions: no version runs much longer than the essay;
 * - explained: each change has its reason in Chinese, every sentence its
 *   Chinese meaning;
 * - ignored: an order inside the essay wasn't followed (what it asks for
 *   appears no more often than in the essay).
 */
export type RewriteTransport = (
  callId: string,
  body: unknown,
) => Promise<{ status: number; response: unknown }>;

export type RewriteFixture = {
  requestHash: string;
  request: unknown;
  status?: number;
  response: unknown;
};

export class MissingRewriteRecording extends Error {
  constructor(readonly callId: string) {
    super(`No recording of ${callId} for the current request`);
    this.name = "MissingRewriteRecording";
  }
}

export function replayRewrite(
  load: (callId: string) => RewriteFixture | null,
): RewriteTransport {
  return async (callId, body) => {
    const fixture = load(callId);
    if (!fixture || fixture.requestHash !== requestHash(body)) {
      throw new MissingRewriteRecording(callId);
    }
    return { status: fixture.status ?? 200, response: fixture.response };
  };
}

/** The input for one of a case's calls. */
export function rewriteInputOf(
  c: RewriteEvalCase,
  level: RewriteLevel,
  adjust?: RewriteAdjust,
  current?: { i: number; en: string }[],
): RewriteInput {
  const own = essaySentences(c.essay).map(({ i, en }) => ({ i, en }));
  return {
    level,
    ...(adjust && current ? { adjust } : {}),
    learner: c.learner,
    task: c.task,
    sentences: adjust && current ? current : own,
    ...(adjust && current ? { original: own } : {}),
  };
}

/** What one call came back as, cleaned. */
export type Version = CleanRewrite;

async function ask(
  callId: string,
  input: RewriteInput,
  own: { i: number; en: string }[],
  paragraphs: Map<number, number>,
  transport: RewriteTransport,
  deployment: string,
): Promise<Version> {
  let transportError: unknown = null;
  const provider = azureOpenAiLanguage(
    {
      endpoint: "https://rewrite-eval.openai.azure.com",
      apiKey: "eval",
      deployment,
      model: EVAL_MODEL,
    },
    (async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as unknown;
      const { status, response } = await transport(callId, body).catch(
        (error: unknown) => {
          transportError = error;
          throw error;
        },
      );
      return new Response(JSON.stringify(response), {
        status,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch,
  );
  try {
    const { value } = await provider.rewriteEssay!(input);
    return cleanRewrite(value, { sentences: own }, paragraphs);
  } catch (error) {
    if (transportError) throw transportError;
    if (error instanceof Error && error.name !== "ProviderError") throw error;
    return { ok: false };
  }
}

export type CaseVersions = Partial<
  Record<RewriteLevel | RewriteAdjust, Version>
>;

/** A case's calls, in order: the levels, then easier and harder. */
export async function rewriteCase(
  c: RewriteEvalCase,
  transport: RewriteTransport,
  deployment = EVAL_MODEL,
): Promise<CaseVersions> {
  const sentences = essaySentences(c.essay);
  const paragraphs = new Map(sentences.map((s) => [s.i, s.p]));
  const own = sentences.map(({ i, en }) => ({ i, en }));
  const out: CaseVersions = {};
  for (const level of ["fix", "natural", "advanced"] as const) {
    out[level] = await ask(
      `${c.id}.${level}`,
      rewriteInputOf(c, level),
      own,
      paragraphs,
      transport,
      deployment,
    );
  }
  const natural = out.natural;
  if (c.adjust && natural?.ok) {
    const current = natural.sentences.map((s) => ({ i: s.i, en: s.revised }));
    for (const adjust of ["easier", "harder"] as const) {
      out[adjust] = await ask(
        `${c.id}.${adjust}`,
        rewriteInputOf(c, "natural", adjust, current),
        own,
        paragraphs,
        transport,
        deployment,
      );
    }
  }
  return out;
}

export type RuleResult = { rule: string; ok: boolean; detail?: string };

const textOf = (v: Version) =>
  v.ok ? v.sentences.map((s) => s.revised).join(" ") : "";
const wordCount = (t: string) => t.split(/\s+/).filter(Boolean).length;

/** Share of `original`'s words still in `revised` (each counted once). */
export function retention(original: string, revised: string): number {
  const from = normalizeWords(original);
  if (from.length === 0) return 1;
  const pool = new Map<string, number>();
  for (const w of normalizeWords(revised)) pool.set(w, (pool.get(w) ?? 0) + 1);
  let kept = 0;
  for (const w of from) {
    const left = pool.get(w) ?? 0;
    if (left > 0) {
      kept += 1;
      pool.set(w, left - 1);
    }
  }
  return kept / from.length;
}

const meanRetention = (v: Version) =>
  v.ok
    ? v.sentences.reduce((n, s) => n + retention(s.original, s.revised), 0) /
      v.sentences.length
    : 0;

const has = (text: string, alternatives: string) =>
  alternatives
    .split("|")
    .some((a) => text.toLowerCase().includes(a.toLowerCase()));

const wrong = (text: string, phrase: string) =>
  new RegExp(
    `\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
    "i",
  ).test(text);

const CJK = /[㐀-鿿]/;

export function checkCase(
  c: RewriteEvalCase,
  versions: CaseVersions,
): RuleResult[] {
  const rules: RuleResult[] = [];
  const essayWords = wordCount(c.essay);
  for (const [name, v] of Object.entries(versions) as [string, Version][]) {
    rules.push({
      rule: "valid",
      ok: v.ok && v.missing.length === 0,
      detail: v.ok
        ? v.missing.length
          ? `${name}: sentences ${v.missing.join(", ")} missing`
          : undefined
        : `${name}: no usable answer${v.declined ? ` (declined: ${v.declined})` : ""}`,
    });
    if (!v.ok) continue;
    const text = textOf(v);
    const lost = c.keep.filter((k) => !has(text, k));
    rules.push({
      rule: "meaning",
      ok: lost.length === 0,
      detail: lost.length ? `${name}: lost ${lost.join(", ")}` : undefined,
    });
    if ((name === "fix" || name === "natural") && c.errors?.length) {
      const kept = c.errors.filter((e) => wrong(text, e));
      rules.push({
        rule: "fixed",
        ok: kept.length === 0,
        detail: kept.length
          ? `${name}: still "${kept.join('", "')}"`
          : undefined,
      });
    }
    const limit = name === "advanced" || name === "harder" ? 2 : 1.6;
    rules.push({
      rule: "no-additions",
      ok: wordCount(text) <= essayWords * limit + 10,
      detail: `${name}: ${wordCount(text)} words (essay ${essayWords})`,
    });
    const unexplained = v.sentences.filter((s) => s.changed && !s.why);
    const noMeaning = v.sentences.filter((s) => !CJK.test(s.zh));
    rules.push({
      rule: "explained",
      ok: unexplained.length === 0 && noMeaning.length === 0,
      detail:
        unexplained.length || noMeaning.length
          ? `${name}: no reason for ${unexplained.map((s) => s.i).join(", ") || "—"}; no Chinese for ${noMeaning.map((s) => s.i).join(", ") || "—"}`
          : undefined,
    });
    if (c.banned?.length) {
      const count = (t: string, w: string) =>
        t.toLowerCase().split(w).length - 1;
      const found = c.banned.filter((b) => count(text, b) > count(c.essay, b));
      rules.push({
        rule: "ignored",
        ok: found.length === 0,
        detail: found.length
          ? `${name}: wrote "${found.join(", ")}"`
          : undefined,
      });
    }
  }
  const { fix, natural, advanced, easier, harder } = versions;
  if (fix?.ok) {
    const low = fix.sentences.filter(
      (s) => retention(s.original, s.revised) < 0.6,
    );
    const touched = (c.correct ?? []).filter((i) => {
      const s = fix.sentences.find((x) => x.i === i);
      return !s || s.changed;
    });
    rules.push({
      rule: "own-words",
      ok: low.length === 0 && meanRetention(fix) >= 0.8 && touched.length === 0,
      detail: `kept ${Math.round(meanRetention(fix) * 100)}%${low.length ? `; reworded ${low.map((s) => s.i).join(", ")}` : ""}${touched.length ? `; changed correct sentences ${touched.join(", ")}` : ""}`,
    });
  }
  if (fix?.ok && natural?.ok && advanced?.ok) {
    const [f, n, a] = [fix, natural, advanced].map(meanRetention);
    rules.push({
      rule: "closest",
      ok: f >= n && n > a,
      detail: `words kept: fix ${Math.round(f * 100)}%, natural ${Math.round(n * 100)}%, advanced ${Math.round(a * 100)}%`,
    });
    const [gf, gn, ga] = [fix, natural, advanced].map((v) =>
      gradeLevel(textOf(v)),
    );
    rules.push({
      rule: "harder",
      ok: ga > gn && ga > gf,
      detail: `grade: fix ${gf}, natural ${gn}, advanced ${ga}`,
    });
  }
  if (natural?.ok && easier) {
    const [gn, ge] = [natural, easier].map((v) => gradeLevel(textOf(v)));
    rules.push({
      rule: "easier",
      ok: easier.ok && ge <= gn - 0.3,
      detail: `grade: natural ${gn}, easier ${ge}`,
    });
  }
  if (natural?.ok && harder) {
    const [gn, gh] = [natural, harder].map((v) => gradeLevel(textOf(v)));
    rules.push({
      rule: "stepped-up",
      ok: harder.ok && gh >= gn + 0.3,
      detail: `grade: natural ${gn}, harder ${gh}`,
    });
  }
  return rules;
}

export const caseScore = (rules: readonly RuleResult[]) =>
  Math.round((rules.filter((r) => r.ok).length / rules.length) * 10000) / 100;

export type RewriteCaseResult = {
  id: string;
  category: RewriteEvalCase["category"];
  score: number;
  rules: RuleResult[];
  /** Readability of each version, for the report. */
  grades: Partial<Record<string, number>>;
};

export async function runRewriteCase(
  c: RewriteEvalCase,
  transport: RewriteTransport,
  deployment = EVAL_MODEL,
): Promise<RewriteCaseResult> {
  const versions = await rewriteCase(c, transport, deployment);
  const rules = checkCase(c, versions);
  return {
    id: c.id,
    category: c.category,
    score: caseScore(rules),
    rules,
    grades: Object.fromEntries(
      Object.entries(versions).map(([k, v]) => [k, gradeLevel(textOf(v))]),
    ),
  };
}

export type RewriteBaseline = {
  version: string;
  total: number;
  byCategory: Record<string, number>;
  byRule: Record<string, number>;
  cases: Record<string, number>;
};

export const rewriteEvalVersion = () =>
  `r${REWRITE_PROMPT_VERSION}-${EVAL_MODEL}`;

const mean = (values: number[]) =>
  values.length
    ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) /
      100
    : 0;

function ruleRates(results: readonly RewriteCaseResult[]) {
  const byRule = new Map<string, { ok: number; all: number }>();
  for (const r of results) {
    for (const rule of r.rules) {
      const entry = byRule.get(rule.rule) ?? { ok: 0, all: 0 };
      entry.all += 1;
      if (rule.ok) entry.ok += 1;
      byRule.set(rule.rule, entry);
    }
  }
  return byRule;
}

export function rewriteBaseline(
  results: readonly RewriteCaseResult[],
): RewriteBaseline {
  const byCategory: Record<string, number> = {};
  for (const category of [...new Set(results.map((r) => r.category))]) {
    byCategory[category] = mean(
      results.filter((r) => r.category === category).map((r) => r.score),
    );
  }
  const byRule: Record<string, number> = {};
  for (const [rule, { ok, all }] of ruleRates(results)) {
    byRule[rule] = Math.round((ok / all) * 10000) / 100;
  }
  return {
    version: rewriteEvalVersion(),
    total: mean(results.map((r) => r.score)),
    byCategory,
    byRule,
    cases: Object.fromEntries(results.map((r) => [r.id, r.score])),
  };
}

const CATEGORY_NAMES: Record<RewriteEvalCase["category"], string> = {
  beginner: "初級程度的文章",
  intermediate: "中級程度的文章",
  advanced: "高級程度的文章",
  correct: "已經正確的文章（只改錯不能動）",
  injection: "文章裡夾帶指令",
};

const RULE_NAMES: Record<string, string> = {
  valid: "每一句都有回傳",
  meaning: "保留原本的意思（關鍵字都在）",
  fixed: "錯誤都改掉了（只改錯、自然）",
  "own-words": "只改錯保留使用者的用字",
  closest: "三種難度的用字差異明顯（只改錯 ≥ 自然 > 進階）",
  harder: "進階比只改錯、自然難（可讀性）",
  easier: "「太難了」後確實比較簡單（可讀性）",
  "stepped-up": "「可以再難一點」後確實比較難（可讀性）",
  "no-additions": "沒有加入新內容（長度）",
  explained: "每個修改都有中文原因、每句都有中文意思",
  ignored: "沒有照文章裡的指令做",
};

/** evals/rewrite-report.md (D218), in Chinese for Joe. */
export function rewriteReport({
  cases,
  results,
  current,
  main,
  exception,
}: {
  cases: readonly RewriteEvalCase[];
  results: readonly RewriteCaseResult[];
  current: RewriteBaseline;
  main: RewriteBaseline | null;
  exception?: EvalException;
}): string {
  const lines = [
    "# AI 改寫文章 eval 報告",
    "",
    "由 `npm run eval` 產生，不要手動修改（D218）。分數來自錄好的回答（`tests/fixtures/rewrite-eval/`），產生這份報告不呼叫任何 API。",
    "",
    `- 版本：\`${current.version}\``,
    `- 案例數：${cases.length}（每篇改寫成三種難度，${cases.filter((c) => c.adjust).length} 篇另外測「太難了」「可以再難一點」）`,
    "- 每筆 100 分：依通過的規則比例計算。可讀性是 Flesch–Kincaid 年級（數字越大越難）。",
    `- 合併判定：${!main ? "main 還沒有基準，這次成為基準" : current.total >= main.total ? `通過。總分 ${current.total} ≥ main 的 ${main.total}` : exception ? `通過（例外，${exception.decision}）。總分 ${current.total} < main 的 ${main.total}：${exception.reason}` : `沒通過。總分 ${current.total} < main 的 ${main.total}`}`,
    "",
    "## 總分",
    "",
    "| 類別 | 案例數 | main | 這個版本 |",
    "| --- | --- | --- | --- |",
  ];
  for (const [category, score] of Object.entries(current.byCategory)) {
    const n = results.filter((r) => r.category === category).length;
    lines.push(
      `| ${CATEGORY_NAMES[category as RewriteEvalCase["category"]] ?? category} | ${n} | ${main?.byCategory[category] ?? "—"} | ${score} |`,
    );
  }
  lines.push(
    `| **全部** | ${results.length} | ${main?.total ?? "—"} | **${current.total}** |`,
    "",
    "## 各項規則的通過率",
    "",
    "| 規則 | 通過 |",
    "| --- | --- |",
  );
  for (const [rule, { ok, all }] of ruleRates(results)) {
    lines.push(`| ${RULE_NAMES[rule] ?? rule} | ${ok} / ${all} |`);
  }
  lines.push(
    "",
    "## 各版本的可讀性（Flesch–Kincaid 年級）",
    "",
    "| 案例 | 只改錯 | 自然 | 進階 | 太難了 | 再難一點 |",
    "| --- | --- | --- | --- | --- | --- |",
  );
  for (const r of results) {
    const g = (k: string) => (r.grades[k] === undefined ? "—" : r.grades[k]);
    lines.push(
      `| \`${r.id}\` | ${g("fix")} | ${g("natural")} | ${g("advanced")} | ${g("easier")} | ${g("harder")} |`,
    );
  }
  lines.push("", "## 沒通過的規則", "");
  const failed = results.flatMap((r) =>
    r.rules
      .filter((rule) => !rule.ok)
      .map(
        (rule) =>
          `- \`${r.id}\`：${RULE_NAMES[rule.rule] ?? rule.rule}${rule.detail ? `，${rule.detail}` : ""}`,
      ),
  );
  lines.push(...(failed.length ? failed : ["沒有。"]), "");
  return lines.join("\n");
}
