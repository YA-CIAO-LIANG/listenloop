/**
 * The writing eval (D188), from recorded answers only (never an API;
 * tests/setup-network.ts blocks the paid hosts):
 *
 *   npm run eval        # also scores the writing golden set and writes
 *                       # evals/writing-baseline.json, evals/writing-report.md
 *   npm run eval:check  # CI: recordings current, baseline up to date,
 *                       # total ≥ main's (a writing-prompt PR must pass)
 *
 * A changed writing prompt or model has no recording: run
 * `npm run eval:writing:record` (it costs: only with Joe's go-ahead).
 */
import { expect, it } from "vitest";
import { WRITING_GOLDEN } from "@/lib/writing/eval/golden";
import { writingReport } from "@/lib/writing/eval/report";
import {
  MissingWritingRecording,
  replayWriting,
  runWritingCase,
  writingBaseline,
  type WritingCaseResult,
} from "@/lib/writing/eval/run";
import {
  loadWritingFixture,
  mainWritingBaseline,
  readBaseline,
  WRITING_EVAL_PATHS,
  writeFile,
} from "./writing-eval-files";

const check = process.env.EVAL_MODE === "check";

it(
  check ? "passes the writing eval gate" : "scores the writing golden set",
  async () => {
    const transport = replayWriting(loadWritingFixture);
    const results: WritingCaseResult[] = [];
    const missing: string[] = [];
    for (const c of WRITING_GOLDEN) {
      try {
        results.push(await runWritingCase(c, transport));
      } catch (error) {
        if (!(error instanceof MissingWritingRecording)) throw error;
        missing.push(`${error.caseId} (${error.attempt})`);
      }
    }
    expect(
      missing,
      "These writing cases have no recording for the current prompt or model. " +
        "Run `npm run eval:writing:record` (real API: only with Joe's go-ahead), then `npm run eval`.",
    ).toEqual([]);
    const current = writingBaseline(results);
    const main = mainWritingBaseline();
    const passes = !main || current.total >= main.total;
    if (check) {
      expect(
        readBaseline(),
        "evals/writing-baseline.json is out of date: run `npm run eval` and commit it",
      ).toEqual(current);
    } else {
      writeFile(
        WRITING_EVAL_PATHS.baseline,
        JSON.stringify(current, null, 2) + "\n",
      );
      writeFile(
        WRITING_EVAL_PATHS.report,
        writingReport({ cases: WRITING_GOLDEN, results, current, main }),
      );
    }
    console.log(
      `Writing eval ${current.version}: ${current.total} (main: ${main?.total ?? "none"})`,
    );
    expect(passes, `the writing eval fell below main's ${main?.total}`).toBe(
      true,
    );
  },
);
