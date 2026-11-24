import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { BackBaseline, BackFixture } from "@/lib/writing/back-check/eval";

/** The back-translation check eval files (D200). */
export const BACK_EVAL_PATHS = {
  fixtures: "tests/fixtures/back-eval",
  baseline: "evals/back-baseline.json",
  report: "evals/back-report.md",
} as const;

const root = process.cwd();
const fixturePath = (caseId: string) =>
  join(root, BACK_EVAL_PATHS.fixtures, `${caseId}.json`);

export function loadBackFixture(caseId: string): BackFixture | null {
  const path = fixturePath(caseId);
  return existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf8")) as BackFixture)
    : null;
}

export function saveBackFixture(caseId: string, fixture: BackFixture) {
  const path = fixturePath(caseId);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(fixture, null, 2) + "\n");
}

export function writeBackFile(path: string, text: string) {
  const full = join(root, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, text);
}

export function readBackBaseline(): BackBaseline | null {
  const full = join(root, BACK_EVAL_PATHS.baseline);
  return existsSync(full)
    ? (JSON.parse(readFileSync(full, "utf8")) as BackBaseline)
    : null;
}

/** main's back-check baseline (EVAL_BASE or origin/main), or null. */
export function mainBackBaseline(): BackBaseline | null {
  const base = process.env.EVAL_BASE?.trim() || "origin/main";
  try {
    return JSON.parse(
      execFileSync("git", ["show", `${base}:${BACK_EVAL_PATHS.baseline}`], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }),
    ) as BackBaseline;
  } catch {
    return null;
  }
}
