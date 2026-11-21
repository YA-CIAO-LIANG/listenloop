import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type {
  WritingAttempt,
  WritingBaseline,
  WritingFixture,
} from "@/lib/writing/eval/run";

/** The writing eval's files (D188). */
export const WRITING_EVAL_PATHS = {
  fixtures: "tests/fixtures/writing-eval",
  baseline: "evals/writing-baseline.json",
  report: "evals/writing-report.md",
} as const;

const root = process.cwd();

const fixturePath = (caseId: string, attempt: WritingAttempt) =>
  join(
    root,
    WRITING_EVAL_PATHS.fixtures,
    attempt === "first" ? `${caseId}.json` : `${caseId}.second.json`,
  );

export function loadWritingFixture(
  caseId: string,
  attempt: WritingAttempt,
): WritingFixture | null {
  const path = fixturePath(caseId, attempt);
  return existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf8")) as WritingFixture)
    : null;
}

export function saveWritingFixture(
  caseId: string,
  attempt: WritingAttempt,
  fixture: WritingFixture,
) {
  const path = fixturePath(caseId, attempt);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(fixture, null, 2) + "\n");
}

export function writeFile(path: string, text: string) {
  const full = join(root, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, text);
}

export function readBaseline(): WritingBaseline | null {
  const full = join(root, WRITING_EVAL_PATHS.baseline);
  return existsSync(full)
    ? (JSON.parse(readFileSync(full, "utf8")) as WritingBaseline)
    : null;
}

/** main's writing baseline (EVAL_BASE or origin/main), or null. */
export function mainWritingBaseline(): WritingBaseline | null {
  const base = process.env.EVAL_BASE?.trim() || "origin/main";
  try {
    return JSON.parse(
      execFileSync("git", ["show", `${base}:${WRITING_EVAL_PATHS.baseline}`], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }),
    ) as WritingBaseline;
  } catch {
    return null;
  }
}
