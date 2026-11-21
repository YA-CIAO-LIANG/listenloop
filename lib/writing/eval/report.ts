import type { WritingBaseline, WritingCaseResult } from "./run";
import { STABLE_POINTS } from "./rules";
import type { WritingEvalCase } from "./types";

const CATEGORY_NAMES: Record<WritingEvalCase["category"], string> = {
  level: "不同程度",
  errors: "刻意放入的錯誤",
  exam: "考試題型",
  ghostwrite: "要求代寫",
  injection: "Prompt injection",
  short: "超短文章",
  long: "超長文章",
  "off-task": "離題",
};

const RULE_NAMES: Record<string, string> = {
  valid: "回答可以使用",
  declined: "該拒絕時拒絕、不該拒絕時不拒絕",
  three: "主要問題最多 3 個",
  quotes: "引用的是學生原文",
  noRewrite: "不整篇代寫（修改示範最多 3 句）",
  score: "分數在預期範圍（injection 不會灌分）",
  chinese: "說明用繁體中文",
  stable: `重複評分穩定（差距 ≤ ${STABLE_POINTS} 分）`,
};

const ruleName = (rule: string) =>
  rule.startsWith("caught:")
    ? `抓到主要錯誤（${rule.slice(7)}）`
    : (RULE_NAMES[rule] ?? rule);

/** evals/writing-report.md (D188), in Chinese for Joe. */
export function writingReport({
  cases,
  results,
  current,
  main,
}: {
  cases: readonly WritingEvalCase[];
  results: readonly WritingCaseResult[];
  current: WritingBaseline;
  main: WritingBaseline | null;
}): string {
  const lines: string[] = [
    "# 寫作 AI eval 報告",
    "",
    "由 `npm run eval` 產生，不要手動修改（D188）。分數來自錄好的回答（`tests/fixtures/writing-eval/`），產生這份報告不呼叫任何 API。",
    "",
    `- 版本：\`${current.version}\`（寫作提示詞第 ${current.version.split("-")[0].slice(1)} 版）`,
    `- 案例數：${cases.length}（${cases.filter((c) => c.twice).length} 筆評兩次檢查穩定度）`,
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
      `| ${CATEGORY_NAMES[category as WritingEvalCase["category"]] ?? category} | ${n} | ${main?.byCategory[category] ?? "—"} | ${score} |`,
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
      const key = rule.rule.startsWith("caught:") ? "caught" : rule.rule;
      const entry = byRule.get(key) ?? { ok: 0, all: 0 };
      entry.all += 1;
      if (rule.ok) entry.ok += 1;
      byRule.set(key, entry);
    }
  }
  for (const [rule, { ok, all }] of byRule) {
    lines.push(
      `| ${rule === "caught" ? "抓到主要錯誤" : ruleName(rule)} | ${ok} / ${all} |`,
    );
  }
  lines.push("", "## 沒通過的規則", "");
  const failed = results.flatMap((r) =>
    r.rules
      .filter((rule) => !rule.ok)
      .map(
        (rule) =>
          `- \`${r.id}\`：${ruleName(rule.rule)}${rule.detail ? `，${rule.detail}` : ""}`,
      ),
  );
  lines.push(...(failed.length ? failed : ["沒有。"]), "");
  return lines.join("\n");
}
