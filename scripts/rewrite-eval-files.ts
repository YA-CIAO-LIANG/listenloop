import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type {
  RewriteBaseline,
  RewriteFixture,
} from "@/lib/writing/rewrite/eval";

/** The essay-rewrite eval files (D218). */
export const REWRITE_EVAL_PATHS = {
  fixtures: "tests/fixtures/rewrite-eval",
  baseline: "evals/rewrite-baseline.json",
  report: "evals/rewrite-report.md",
} as const;

const root = process.cwd();
const fixturePath = (callId: string) =>
  join(root, REWRITE_EVAL_PATHS.fixtures, `${callId}.json`);

export function loadRewriteFixture(callId: string): RewriteFixture | null {
  const path = fixturePath(callId);
  return existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf8")) as RewriteFixture)
    : null;
}

export function saveRewriteFixture(callId: string, fixture: RewriteFixture) {
  const path = fixturePath(callId);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(fixture, null, 2) + "\n");
}

export function writeRewriteFile(path: string, text: string) {
  const full = join(root, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, text);
}

export function readRewriteBaseline(): RewriteBaseline | null {
  const full = join(root, REWRITE_EVAL_PATHS.baseline);
  return existsSync(full)
    ? (JSON.parse(readFileSync(full, "utf8")) as RewriteBaseline)
    : null;
}

/** main's rewrite baseline (EVAL_BASE or origin/main), or null. */
export function mainRewriteBaseline(): RewriteBaseline | null {
  const base = process.env.EVAL_BASE?.trim() || "origin/main";
  try {
    return JSON.parse(
      execFileSync("git", ["show", `${base}:${REWRITE_EVAL_PATHS.baseline}`], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }),
    ) as RewriteBaseline;
  } catch {
    return null;
  }
}
