import { azureOpenAiLanguage } from "@/lib/ai/azure-openai";
import { EVAL_MODEL } from "@/lib/evals/config";
import { requestHash } from "@/lib/evals/run";
import { cleanBackCheck } from "./clean";
import type { BackEvalCase } from "./golden";
import { BACK_CHECK_PROMPT_VERSION } from "./prompts";
import type { BackJudgement } from "./types";

/**
 * The back-translation check's eval (D200): each golden case through the
 * production provider code and cleaning, from a recording (free) or the
 * real API (recording, with Joe's go-ahead), checked by rules, per
 * answer:
 * - valid: a judgement came back;
 * - meaning, grammar: as expected (where the case says);
 * - chinese: the reason is in Chinese;
 * - better: a grammar mistake comes with a corrected version.
 */
export type BackTransport = (
  caseId: string,
  body: unknown,
) => Promise<{ status: number; response: unknown }>;

export type BackFixture = {
  requestHash: string;
  request: unknown;
  status?: number;
  response: unknown;
};

export class MissingBackRecording extends Error {
  constructor(readonly caseId: string) {
    super(`No recording of ${caseId} for the current request`);
    this.name = "MissingBackRecording";
  }
}

export function replayBack(
  load: (caseId: string) => BackFixture | null,
): BackTransport {
  return async (caseId, body) => {
    const fixture = load(caseId);
    if (!fixture || fixture.requestHash !== requestHash(body)) {
      throw new MissingBackRecording(caseId);
    }
    return { status: fixture.status ?? 200, response: fixture.response };
  };
}

/**
 * The provider's safety filter refused the request: in the app the
 * rules' results stand, so it is right only where the answer is wrong by
 * meaning (what the rules say of a non-matching answer).
 */
const FILTERED = "filtered" as const;

async function ask(
  c: BackEvalCase,
  transport: BackTransport,
  deployment: string,
): Promise<Map<number, BackJudgement> | typeof FILTERED> {
  let transportError: unknown = null;
  const provider = azureOpenAiLanguage(
    {
      endpoint: "https://back-eval.openai.azure.com",
      apiKey: "eval",
      deployment,
      model: EVAL_MODEL,
    },
    (async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as unknown;
      const { status, response } = await transport(c.id, body).catch(
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
  const input = { items: c.items };
  try {
    const { value } = await provider.checkBack!(input);
    return cleanBackCheck(value, input);
  } catch (error) {
    if (transportError) throw transportError;
    if (error instanceof Error && error.name !== "ProviderError") throw error;
    if ((error as { code?: string }).code === "filtered") return FILTERED;
    return new Map();
  }
}

export type RuleResult = { rule: string; ok: boolean; detail?: string };

const hasHan = (text: string) => /\p{Script=Han}/u.test(text);

export function checkCase(
  c: BackEvalCase,
  judged: Map<number, BackJudgement> | typeof FILTERED,
): RuleResult[] {
  if (judged === FILTERED) {
    return c.items.map((item) => ({
      rule: "meaning",
      ok: c.expect[item.i]?.meaning === false,
      detail: `${item.i}: filtered by the provider; the rules' result stands`,
    }));
  }
  return c.items.flatMap((item) => {
    const j = judged.get(item.i);
    const expect = c.expect[item.i] ?? {};
    if (!j) {
      return [{ rule: "valid", ok: false, detail: `item ${item.i}` }];
    }
    const rules: RuleResult[] = [{ rule: "valid", ok: true }];
    if (expect.meaning !== undefined) {
      rules.push({
        rule: "meaning",
        ok: j.meaning === expect.meaning,
        detail: `${item.i}: ${j.meaning}, expected ${expect.meaning}; ${j.why}`,
      });
    }
    if (expect.grammar !== undefined) {
      rules.push({
        rule: "grammar",
        ok: j.grammar === expect.grammar,
        detail: `${item.i}: ${j.grammar}, expected ${expect.grammar}; ${j.why}`,
      });
    }
    rules.push({ rule: "chinese", ok: hasHan(j.why), detail: j.why });
    if (expect.grammar === false && item.mode !== "listen-zh") {
      rules.push({
        rule: "better",
        ok: j.better.length > 0,
        detail: j.better || "none",
      });
    }
    return rules;
  });
}

export const caseScore = (rules: readonly RuleResult[]) =>
  Math.round((rules.filter((r) => r.ok).length / rules.length) * 10000) / 100;

export type BackCaseResult = {
  id: string;
  category: BackEvalCase["category"];
  score: number;
  rules: RuleResult[];
};

export async function runBackCase(
  c: BackEvalCase,
  transport: BackTransport,
  deployment = EVAL_MODEL,
): Promise<BackCaseResult> {
  const rules = checkCase(c, await ask(c, transport, deployment));
  return { id: c.id, category: c.category, score: caseScore(rules), rules };
}

export type BackBaseline = {
  version: string;
  total: number;
  byCategory: Record<string, number>;
  cases: Record<string, number>;
};

export const backEvalVersion = () =>
  `b${BACK_CHECK_PROMPT_VERSION}-${EVAL_MODEL}`;

const mean = (values: number[]) =>
  values.length
    ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) /
      100
    : 0;

export function backBaseline(results: readonly BackCaseResult[]): BackBaseline {
  const byCategory: Record<string, number> = {};
  for (const category of [...new Set(results.map((r) => r.category))]) {
    byCategory[category] = mean(
      results.filter((r) => r.category === category).map((r) => r.score),
    );
  }
  return {
    version: backEvalVersion(),
    total: mean(results.map((r) => r.score)),
    byCategory,
    cases: Object.fromEntries(results.map((r) => [r.id, r.score])),
  };
}

const CATEGORY_NAMES: Record<BackEvalCase["category"], string> = {
  synonym: "同義但不同用字（應判正確）",
  grammar: "文法錯誤（要抓到）",
  meaning: "意思錯誤（要指出）",
  picky: "小差異（不能過度挑剔）",
  injection: "答案裡夾帶指令",
  batch: "一次批改整組",
};

const RULE_NAMES: Record<string, string> = {
  valid: "有回傳判斷",
  meaning: "意思判斷正確",
  grammar: "文法判斷正確",
  chinese: "說明用中文",
  better: "文法錯誤時提供修正",
};

/** evals/back-report.md (D200), in Chinese for Joe. */
export function backReport({
  cases,
  results,
  current,
  main,
}: {
  cases: readonly BackEvalCase[];
  results: readonly BackCaseResult[];
  current: BackBaseline;
  main: BackBaseline | null;
}): string {
  const lines = [
    "# 額外練習 AI 批改 eval 報告",
    "",
    "由 `npm run eval` 產生，不要手動修改（D200）。分數來自錄好的回答（`tests/fixtures/back-eval/`），產生這份報告不呼叫任何 API。",
    "",
    `- 版本：\`${current.version}\``,
    `- 案例數：${cases.length}（答案 ${cases.reduce((n, c) => n + c.items.length, 0)} 句）`,
    "- 每筆 100 分：依通過的規則比例計算。",
    `- 合併判定：${!main ? "main 還沒有基準，這次成為基準" : current.total >= main.total ? `通過。總分 ${current.total} ≥ main 的 ${main.total}` : `沒通過。總分 ${current.total} < main 的 ${main.total}`}`,
    "",
    "## 總分",
    "",
    "| 類別 | 案例數 | main | 這個版本 |",
    "| --- | --- | --- | --- |",
  ];
  for (const [category, score] of Object.entries(current.byCategory)) {
    const n = results.filter((r) => r.category === category).length;
    lines.push(
      `| ${CATEGORY_NAMES[category as BackEvalCase["category"]] ?? category} | ${n} | ${main?.byCategory[category] ?? "—"} | ${score} |`,
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
  const byRule = new Map<string, { ok: number; all: number }>();
  for (const r of results) {
    for (const rule of r.rules) {
      const entry = byRule.get(rule.rule) ?? { ok: 0, all: 0 };
      entry.all += 1;
      if (rule.ok) entry.ok += 1;
      byRule.set(rule.rule, entry);
    }
  }
  for (const [rule, { ok, all }] of byRule) {
    lines.push(`| ${RULE_NAMES[rule] ?? rule} | ${ok} / ${all} |`);
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
