/**
 * The AI eval (D150), from the recorded answers only; it never calls an
 * API (tests/setup-network.ts blocks the paid hosts):
 *
 *   npm run eval        # scores, writes evals/baseline.json and evals/report.md
 *   npm run eval:check  # CI: recordings current, baseline up to date, score ≥ main's
 *
 * A changed prompt or model has no recording yet: run `npm run
 * eval:record` (it costs, so only with Joe's go-ahead), then `npm run eval`.
 */
import { expect, it } from "vitest";
import { EVAL_PATHS } from "@/lib/evals/config";
import { GOLDEN_SET } from "@/lib/evals/golden";
import { evalReport } from "@/lib/evals/report";
import {
  baselineOf,
  gate,
  MissingRecording,
  replayTransport,
  runCase,
} from "@/lib/evals/run";
import type { CaseResult, EvalBaseline } from "@/lib/evals/types";
import {
  loadExceptions,
  loadFixture,
  mainBaseline,
  readJson,
  writeText,
} from "./eval-files";

const check = process.env.EVAL_MODE === "check";

it(check ? "passes the eval gate" : "scores the golden set", async () => {
  const transport = replayTransport(loadFixture);
  const results: CaseResult[] = [];
  const missing: string[] = [];
  for (const evalCase of GOLDEN_SET) {
    try {
      results.push(await runCase(evalCase, transport));
    } catch (error) {
      if (!(error instanceof MissingRecording)) throw error;
      missing.push(`${error.caseId} (${error.step})`);
    }
  }
  expect(
    missing,
    "These cases' requests changed (prompt, model, or the answer the judge grades) " +
      "and have no recording yet. Run `npm run eval:record` (it calls the real API: " +
      "only with Joe's go-ahead), then `npm run eval`.",
  ).toEqual([]);

  const current = baselineOf(results);
  const previous = mainBaseline();
  const verdict = gate(current, previous, loadExceptions());
  const report = evalReport({
    cases: GOLDEN_SET,
    results,
    current,
    previous,
    verdict,
  });

  if (check) {
    const saved = readJson<EvalBaseline>(EVAL_PATHS.baseline);
    expect(
      saved,
      "evals/baseline.json is out of date: run `npm run eval` and commit it",
    ).toEqual(current);
  } else {
    writeText(EVAL_PATHS.baseline, JSON.stringify(current, null, 2) + "\n");
    writeText(EVAL_PATHS.report, report);
  }
  console.log(
    `Eval ${current.version}: ${current.total} (main: ${previous?.total ?? "none"}). ` +
      (verdict.ok ? verdict.note : verdict.why),
  );
  expect(verdict.ok, verdict.ok ? "" : verdict.why).toBe(true);
});
