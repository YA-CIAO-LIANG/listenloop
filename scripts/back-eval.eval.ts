/**
 * The back-translation check's eval (D200), from recorded answers only
 * (never an API; tests/setup-network.ts blocks the paid hosts):
 *
 *   npm run eval        # also scores this golden set and writes
 *                       # evals/back-baseline.json, evals/back-report.md
 *   npm run eval:check  # CI: recordings current, baseline up to date,
 *                       # total ≥ main's
 *
 * A changed prompt or model has no recording: run
 * `npm run eval:back:record` (it costs: only with Joe's go-ahead).
 */
import { expect, it } from "vitest";
import {
  backBaseline,
  backReport,
  MissingBackRecording,
  replayBack,
  runBackCase,
  type BackCaseResult,
} from "@/lib/writing/back-check/eval";
import { BACK_GOLDEN } from "@/lib/writing/back-check/golden";
import {
  BACK_EVAL_PATHS,
  loadBackFixture,
  mainBackBaseline,
  readBackBaseline,
  writeBackFile,
} from "./back-eval-files";

const check = process.env.EVAL_MODE === "check";

it(
  check
    ? "passes the back-translation check eval gate"
    : "scores the back-translation check golden set",
  async () => {
    const transport = replayBack(loadBackFixture);
    const results: BackCaseResult[] = [];
    const missing: string[] = [];
    for (const c of BACK_GOLDEN) {
      try {
        results.push(await runBackCase(c, transport));
      } catch (error) {
        if (!(error instanceof MissingBackRecording)) throw error;
        missing.push(error.caseId);
      }
    }
    expect(
      missing,
      "These cases have no recording for the current prompt or model. " +
        "Run `npm run eval:back:record` (real API: only with Joe's go-ahead), then `npm run eval`.",
    ).toEqual([]);
    const current = backBaseline(results);
    const main = mainBackBaseline();
    const passes = !main || current.total >= main.total;
    if (check) {
      expect(
        readBackBaseline(),
        "evals/back-baseline.json is out of date: run `npm run eval` and commit it",
      ).toEqual(current);
    } else {
      writeBackFile(
        BACK_EVAL_PATHS.baseline,
        JSON.stringify(current, null, 2) + "\n",
      );
      writeBackFile(
        BACK_EVAL_PATHS.report,
        backReport({ cases: BACK_GOLDEN, results, current, main }),
      );
    }
    console.log(
      `Back-check eval ${current.version}: ${current.total} (main: ${main?.total ?? "none"})`,
    );
    expect(passes, `the back-check eval fell below main's ${main?.total}`).toBe(
      true,
    );
  },
);
