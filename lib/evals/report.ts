import { createHash } from "node:crypto";
import { EVAL_WEIGHTS, SPOT_CHECKS } from "./config";
import type { Gate } from "./run";
import type { CaseResult, EvalBaseline, EvalCase } from "./types";

/**
 * The report for checking by hand (D150): old and new scores side by
 * side, every case with its answer, rule results, and grade, and a fixed
 * pick of cases to spot-check.
 */

const OPERATION_NAMES: Record<string, string> = {
  segment: "斷句",
  translate: "翻譯",
  annotate: "單字、文法與連音講解",
  compose: "AI 生成教材",
  describe: "標題與摘要",
  revise: "用指令修改",
};

/**
 * The cases to check by hand: every regression case, one per operation,
 * then the rest in an order fixed by the version, up to SPOT_CHECKS
 * (at least every regression case).
 */
export function spotChecks(
  cases: readonly EvalCase[],
  version: string,
): string[] {
  const order = (id: string) =>
    createHash("sha256").update(`${version}:${id}`).digest("hex");
  const shuffled = [...cases].sort((a, b) =>
    order(a.id).localeCompare(order(b.id)),
  );
  const picked: string[] = cases.filter((c) => c.regression).map((c) => c.id);
  for (const operation of Object.keys(OPERATION_NAMES)) {
    const first = shuffled.find(
      (c) => c.operation === operation && !picked.includes(c.id),
    );
    if (
      first &&
      !cases.some((c) => c.operation === operation && picked.includes(c.id))
    ) {
      picked.push(first.id);
    }
  }
  for (const c of shuffled) {
    if (picked.length >= SPOT_CHECKS) break;
    if (!picked.includes(c.id)) picked.push(c.id);
  }
  return picked;
}

const cell = (text: string) => text.replace(/\|/g, "\\|").replace(/\n/g, " ");
const json = (value: unknown) =>
  ["```json", JSON.stringify(value, null, 2), "```"].join("\n");
const signed = (n: number) => (n > 0 ? `+${n.toFixed(2)}` : n.toFixed(2));

export function evalReport({
  cases,
  results,
  current,
  previous,
  verdict,
}: {
  cases: readonly EvalCase[];
  results: readonly CaseResult[];
  current: EvalBaseline;
  previous: EvalBaseline | null;
  verdict: Gate;
}): string {
  const byId = new Map(cases.map((c) => [c.id, c]));
  const before = new Map(previous?.cases.map((c) => [c.id, c.score]) ?? []);
  const cost = results.reduce((sum, r) => sum + r.costUsd, 0);
  const out: string[] = [];

  out.push(
    "# AI eval 報告",
    "",
    "由 `npm run eval` 產生，不要手動修改（D150）。分數來自錄好的回答（`tests/fixtures/eval/`），產生這份報告不呼叫任何 API。",
    "",
    `- 版本：\`${current.version}\`（模型 ${current.model}，評分標準第 ${current.judgeVersion} 版）`,
    `- 每筆 100 分：規則 ${EVAL_WEIGHTS.rules} 分（依通過比例）＋ AI 評分 ${EVAL_WEIGHTS.judge} 分（1～5 分換算）；沒有 AI 評分的案例只看規則。`,
    `- 錄製這些回答的費用：US$${cost.toFixed(4)}`,
    `- 合併判定：${verdict.ok ? `通過。${verdict.note}` : `不通過。${verdict.why}`}`,
    "",
    "## 總分",
    "",
    "| 類別 | 案例數 | main | 這個版本 | 差異 |",
    "| --- | --- | --- | --- | --- |",
  );
  for (const [operation, score] of Object.entries(current.byOperation)) {
    const old = previous?.byOperation[operation];
    out.push(
      `| ${OPERATION_NAMES[operation] ?? operation} | ${results.filter((r) => r.operation === operation).length} | ${old ?? "—"} | ${score} | ${old === undefined ? "—" : signed(score - old)} |`,
    );
  }
  out.push(
    `| **全部** | ${results.length} | ${previous?.total ?? "—"} | **${current.total}** | ${previous ? signed(current.total - previous.total) : "—"} |`,
    "",
  );

  const worse = results.filter(
    (r) => before.has(r.id) && r.score < (before.get(r.id) ?? 0),
  );
  out.push("## 退步的案例", "");
  out.push(
    worse.length === 0
      ? "沒有。"
      : worse
          .map(
            (r) =>
              `- \`${r.id}\` ${byId.get(r.id)?.title ?? ""}：${before.get(r.id)} → ${r.score}`,
          )
          .join("\n"),
    "",
  );

  const failing = results.filter((r) => r.rules.some((rule) => !rule.pass));
  out.push("## 沒通過的規則", "");
  out.push(
    failing.length === 0
      ? "全部通過。"
      : failing
          .flatMap((r) =>
            r.rules
              .filter((rule) => !rule.pass)
              .map((rule) => `- \`${r.id}\`：${rule.kind}，${rule.detail}`),
          )
          .join("\n"),
    "",
  );

  const spot = spotChecks(cases, current.version);
  out.push(
    "## 建議人工抽查",
    "",
    "依版本固定選出（每個回歸案例、每個類別至少一筆）。請對照下方的完整內容，看 AI 評分是否合理。",
    "",
    "| 案例 | 內容 | 分數 | AI 評分 |",
    "| --- | --- | --- | --- |",
    ...spot.map((id) => {
      const r = results.find((x) => x.id === id);
      return `| [\`${id}\`](#${id}) | ${cell(byId.get(id)?.title ?? "")} | ${r?.score ?? "—"} | ${r?.judge ? `${r.judge.score}/5` : "—"} |`;
    }),
    "",
    "## 每個案例",
    "",
  );

  for (const r of results) {
    const evalCase = byId.get(r.id);
    out.push(
      `### ${r.id}`,
      "",
      `**${evalCase?.title ?? ""}**（${OPERATION_NAMES[r.operation] ?? r.operation}）：${r.score} 分${before.has(r.id) ? `（main：${before.get(r.id)}）` : ""}`,
      "",
    );
    if (evalCase?.regression) {
      out.push(
        `> 回歸案例（${evalCase.regression.decision}）：${evalCase.regression.issue}`,
        "",
      );
    }
    out.push(
      "規則：",
      "",
      ...r.rules.map(
        (rule) =>
          `- ${rule.pass ? "✓" : "✗"} ${rule.kind}${rule.detail ? `：${rule.detail}` : ""}`,
      ),
      "",
    );
    if (evalCase?.judge) {
      out.push(
        `AI 評分標準：${evalCase.judge}`,
        "",
        r.judge
          ? `AI 評分：**${r.judge.score}/5**，${r.judge.reason}`
          : "AI 評分：沒有（答案無法使用，或評分失敗）",
        "",
      );
    }
    out.push(
      "<details><summary>輸入與結果</summary>",
      "",
      json(evalCase?.input),
      "",
      json(r.output),
      "",
      "</details>",
      "",
    );
  }
  return out.join("\n");
}
