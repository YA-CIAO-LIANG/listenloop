import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { EVAL_PATHS } from "@/lib/evals/config";
import type { EvalException, EvalStep } from "@/lib/evals/run";
import type { EvalBaseline, EvalFixture } from "@/lib/evals/types";

/**
 * Reading and writing the eval's files (D150): recordings, the baseline,
 * the exceptions, and main's baseline from git.
 */

const root = process.cwd();

export function fixturePath(caseId: string, step: EvalStep): string {
  return join(
    root,
    EVAL_PATHS.fixtures,
    step === "answer" ? `${caseId}.json` : `${caseId}.judge.json`,
  );
}

export function loadFixture(
  caseId: string,
  step: EvalStep,
): EvalFixture | null {
  const path = fixturePath(caseId, step);
  return existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf8")) as EvalFixture)
    : null;
}

export function saveFixture(
  caseId: string,
  step: EvalStep,
  fixture: EvalFixture,
): void {
  const path = fixturePath(caseId, step);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(fixture, null, 2) + "\n");
}

export function readJson<T>(path: string): T | null {
  const full = join(root, path);
  return existsSync(full)
    ? (JSON.parse(readFileSync(full, "utf8")) as T)
    : null;
}

export function writeText(path: string, text: string): void {
  const full = join(root, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, text);
}

export const loadExceptions = () =>
  readJson<EvalException[]>(EVAL_PATHS.exceptions) ?? [];

/**
 * main's baseline, to compare with: from EVAL_BASE (the commit CI
 * compares with) or origin/main. Null when main has none yet.
 */
export function mainBaseline(): EvalBaseline | null {
  const base = process.env.EVAL_BASE?.trim() || "origin/main";
  try {
    const text = execFileSync(
      "git",
      ["show", `${base}:${EVAL_PATHS.baseline}`],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    return JSON.parse(text) as EvalBaseline;
  } catch {
    return null;
  }
}
