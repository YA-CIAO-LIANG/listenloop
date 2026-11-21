import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ChatBaseline, ChatFixture } from "@/lib/writing/chat/eval";

/** The chat eval's files (D197). */
export const CHAT_EVAL_PATHS = {
  fixtures: "tests/fixtures/chat-eval",
  baseline: "evals/chat-baseline.json",
  report: "evals/chat-report.md",
} as const;

const root = process.cwd();
const fixturePath = (caseId: string) =>
  join(root, CHAT_EVAL_PATHS.fixtures, `${caseId}.json`);

export function loadChatFixture(caseId: string): ChatFixture | null {
  const path = fixturePath(caseId);
  return existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf8")) as ChatFixture)
    : null;
}

export function saveChatFixture(caseId: string, fixture: ChatFixture) {
  const path = fixturePath(caseId);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(fixture, null, 2) + "\n");
}

export function writeChatFile(path: string, text: string) {
  const full = join(root, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, text);
}

export function readChatBaseline(): ChatBaseline | null {
  const full = join(root, CHAT_EVAL_PATHS.baseline);
  return existsSync(full)
    ? (JSON.parse(readFileSync(full, "utf8")) as ChatBaseline)
    : null;
}

/** main's chat baseline (EVAL_BASE or origin/main), or null. */
export function mainChatBaseline(): ChatBaseline | null {
  const base = process.env.EVAL_BASE?.trim() || "origin/main";
  try {
    return JSON.parse(
      execFileSync("git", ["show", `${base}:${CHAT_EVAL_PATHS.baseline}`], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }),
    ) as ChatBaseline;
  } catch {
    return null;
  }
}
