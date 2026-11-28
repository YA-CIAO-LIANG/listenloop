/**
 * The essay-rewrite eval (D218), from recorded answers only (never an
 * API; tests/setup-network.ts blocks the paid hosts):
 *
 *   npm run eval        # also scores this golden set and writes
 *                       # evals/rewrite-baseline.json, evals/rewrite-report.md
 *   npm run eval:check  # CI: recordings current, baseline up to date,
 *                       # total ≥ main's
 *
 * A changed prompt or model has no recording: run
 * `npm run eval:rewrite:record` (it costs: only with Joe's go-ahead).
 */
import { expect, it } from "vitest";
import {
  MissingRewriteRecording,
  replayRewrite,
  rewriteBaseline,
  rewriteReport,
  runRewriteCase,
  type RewriteCaseResult,
} from "@/lib/writing/rewrite/eval";
import { REWRITE_GOLDEN } from "@/lib/writing/rewrite/golden";
import { loadExceptions } from "./eval-files";
import {
  loadRewriteFixture,
  mainRewriteBaseline,
  readRewriteBaseline,
  REWRITE_EVAL_PATHS,
  writeRewriteFile,
} from "./rewrite-eval-files";

const check = process.env.EVAL_MODE === "check";

it(
  check
    ? "passes the essay-rewrite eval gate"
    : "scores the essay-rewrite golden set",
  async () => {
    const transport = replayRewrite(loadRewriteFixture);
    const results: RewriteCaseResult[] = [];
    const missing: string[] = [];
    for (const c of REWRITE_GOLDEN) {
      try {
        results.push(await runRewriteCase(c, transport));
      } catch (error) {
        if (!(error instanceof MissingRewriteRecording)) throw error;
        missing.push(error.callId);
      }
    }
    expect(
      missing,
      "These calls have no recording for the current prompt or model. " +
        "Run `npm run eval:rewrite:record` (real API: only with Joe's go-ahead), then `npm run eval`.",
    ).toEqual([]);
    const current = rewriteBaseline(results);
    const main = mainRewriteBaseline();
    const exception = loadExceptions().find(
      (e) => e.version === current.version,
    );
    const passes = !main || current.total >= main.total || !!exception;
    if (check) {
      expect(
        readRewriteBaseline(),
        "evals/rewrite-baseline.json is out of date: run `npm run eval` and commit it",
      ).toEqual(current);
    } else {
      writeRewriteFile(
        REWRITE_EVAL_PATHS.baseline,
        JSON.stringify(current, null, 2) + "\n",
      );
      writeRewriteFile(
        REWRITE_EVAL_PATHS.report,
        rewriteReport({
          cases: REWRITE_GOLDEN,
          results,
          current,
          main,
          exception,
        }),
      );
    }
    console.log(
      `Rewrite eval ${current.version}: ${current.total} (main: ${main?.total ?? "none"})`,
    );
    expect(passes, `the rewrite eval fell below main's ${main?.total}`).toBe(
      true,
    );
  },
);
