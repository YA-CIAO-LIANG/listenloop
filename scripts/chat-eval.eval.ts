/**
 * The chat eval (D197), from recorded answers only (never an API;
 * tests/setup-network.ts blocks the paid hosts):
 *
 *   npm run eval        # also scores the chat golden set and writes
 *                       # evals/chat-baseline.json, evals/chat-report.md
 *   npm run eval:check  # CI: recordings current, baseline up to date,
 *                       # total ≥ main's
 *
 * A changed chat prompt or model has no recording: run
 * `npm run eval:chat:record` (it costs: only with Joe's go-ahead).
 */
import { expect, it } from "vitest";
import {
  chatBaseline,
  chatReport,
  MissingChatRecording,
  replayChat,
  runChatCase,
  type ChatCaseResult,
} from "@/lib/writing/chat/eval";
import { CHAT_GOLDEN } from "@/lib/writing/chat/golden";
import {
  CHAT_EVAL_PATHS,
  loadChatFixture,
  mainChatBaseline,
  readChatBaseline,
  writeChatFile,
} from "./chat-eval-files";

const check = process.env.EVAL_MODE === "check";

it(
  check ? "passes the chat eval gate" : "scores the chat golden set",
  async () => {
    const transport = replayChat(loadChatFixture);
    const results: ChatCaseResult[] = [];
    const missing: string[] = [];
    for (const c of CHAT_GOLDEN) {
      try {
        results.push(await runChatCase(c, transport));
      } catch (error) {
        if (!(error instanceof MissingChatRecording)) throw error;
        missing.push(error.caseId);
      }
    }
    expect(
      missing,
      "These chat cases have no recording for the current prompt or model. " +
        "Run `npm run eval:chat:record` (real API: only with Joe's go-ahead), then `npm run eval`.",
    ).toEqual([]);
    const current = chatBaseline(results);
    const main = mainChatBaseline();
    const passes = !main || current.total >= main.total;
    if (check) {
      expect(
        readChatBaseline(),
        "evals/chat-baseline.json is out of date: run `npm run eval` and commit it",
      ).toEqual(current);
    } else {
      writeChatFile(
        CHAT_EVAL_PATHS.baseline,
        JSON.stringify(current, null, 2) + "\n",
      );
      writeChatFile(
        CHAT_EVAL_PATHS.report,
        chatReport({ cases: CHAT_GOLDEN, results, current, main }),
      );
    }
    console.log(
      `Chat eval ${current.version}: ${current.total} (main: ${main?.total ?? "none"})`,
    );
    expect(passes, `the chat eval fell below main's ${main?.total}`).toBe(true);
  },
);
