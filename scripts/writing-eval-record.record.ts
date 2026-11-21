/**
 * Records the writing golden set's answers from the real model (D188):
 * only cases whose request changed (prompt or model) or that were never
 * recorded.
 *
 *   npm run eval:writing:record                 # dry run: calls and worst case
 *   AI_RECORD_YES=1 npm run eval:writing:record # records (Joe's go-ahead)
 *
 * One run spends at most WRITING_EVAL_BUDGET_USD: before each call, what
 * was spent plus that call's worst case must fit, or it stops. Each call
 * goes to api_calls as "eval:writing" (/admin/usage). Then `npm run eval`.
 */
import { createClient } from "@supabase/supabase-js";
import { expect, it } from "vitest";
import {
  azureEndpoint,
  azureModelPrice,
  azureUsage,
} from "@/lib/ai/azure-openai";
import { maxCost, writingBudget } from "@/lib/ai/budgets";
import { toMicros } from "@/lib/ai/pricing";
import { EVAL_MODEL } from "@/lib/evals/config";
import { requestHash } from "@/lib/evals/run";
import { WRITING_GOLDEN } from "@/lib/writing/eval/golden";
import { runWritingCase, type WritingTransport } from "@/lib/writing/eval/run";
import type { WritingEvalCase } from "@/lib/writing/eval/types";
import { loadWritingFixture, saveWritingFixture } from "./writing-eval-files";

/** The most one recording run may spend (Joe's nightly allowance, D188). */
const WRITING_EVAL_BUDGET_USD = 0.45;

class BudgetStop extends Error {
  constructor(readonly caseId: string) {
    super(`budget reached before ${caseId}`);
    this.name = "BudgetStop";
  }
}

const env = (name: string) => process.env[name]?.trim() ?? "";
const price = azureModelPrice(EVAL_MODEL)!;
const worstCase = (c: WritingEvalCase) =>
  toMicros(maxCost(writingBudget({ essay: c.essay, task: c.task }), price));

it("records the writing golden set", async () => {
  expect(env("LISTENLOOP_UNATTENDED"), "no paid calls unattended").not.toBe(
    "1",
  );
  expect(env("AZURE_OPENAI_MODEL"), "recorded with production's model").toBe(
    EVAL_MODEL,
  );
  const endpoint = azureEndpoint(env("AZURE_OPENAI_ENDPOINT"));
  const deployment = env("AZURE_OPENAI_DEPLOYMENT");
  const apiKey = env("AZURE_OPENAI_API_KEY");
  const yes = env("AI_RECORD_YES") === "1";
  const asked = Number(env("EVAL_LIMIT_USD"));
  const limit =
    asked > 0
      ? Math.min(asked, WRITING_EVAL_BUDGET_USD)
      : WRITING_EVAL_BUDGET_USD;
  const cap = toMicros(limit);
  const supabase =
    yes && env("NEXT_PUBLIC_SUPABASE_URL") && env("SUPABASE_SERVICE_ROLE_KEY")
      ? createClient(
          env("NEXT_PUBLIC_SUPABASE_URL"),
          env("SUPABASE_SERVICE_ROLE_KEY"),
          { auth: { persistSession: false } },
        )
      : null;

  let spent = 0;
  let planned = 0;
  let calls = 0;
  const usage = { inputTokens: 0, outputTokens: 0 };
  let current = WRITING_GOLDEN[0];

  const transport: WritingTransport = async (caseId, attempt, body) => {
    const recorded = loadWritingFixture(caseId, attempt);
    if (recorded && recorded.requestHash === requestHash(body)) {
      return { status: recorded.status ?? 200, response: recorded.response };
    }
    const worst = worstCase(current);
    if (!yes) {
      planned += worst;
      calls += 1;
      return { status: 400, response: { error: { code: "dry-run" } } };
    }
    if (spent + worst > cap) throw new BudgetStop(caseId);
    // A dropped connection is retried (nothing was billed for it).
    let response: Response | null = null;
    for (let tries = 0; !response; tries++) {
      try {
        response = await fetch(`${endpoint}/openai/v1/chat/completions`, {
          method: "POST",
          headers: { "content-type": "application/json", "api-key": apiKey },
          body: JSON.stringify(body),
        });
      } catch (error) {
        if (tries >= 3) throw error;
        await new Promise((resolve) => setTimeout(resolve, 2_000));
      }
    }
    const data = (await response.json()) as Parameters<typeof azureUsage>[0];
    const used = azureUsage(data, price, 0);
    spent += toMicros(used.costUsd);
    calls += 1;
    usage.inputTokens += used.inputTokens;
    usage.outputTokens += used.outputTokens;
    saveWritingFixture(caseId, attempt, {
      requestHash: requestHash(body),
      request: body,
      ...(response.status === 200 ? {} : { status: response.status }),
      response: data,
    });
    await supabase?.from("api_calls").insert({
      user_id: null,
      provider: `azure-openai/${EVAL_MODEL}`,
      operation: "eval:writing",
      http_status: response.status,
      error: response.status === 200 ? null : "failed",
      input_tokens: used.inputTokens,
      output_tokens: used.outputTokens,
      chars: 0,
      cost_micros: toMicros(used.costUsd),
    });
    console.log(
      `${caseId} ${attempt}: ${used.inputTokens} in / ${used.outputTokens} out, US$${used.costUsd.toFixed(6)}`,
    );
    return { status: response.status, response: data };
  };

  if (yes) {
    expect(
      endpoint && deployment && apiKey,
      "Azure OpenAI settings",
    ).toBeTruthy();
  }
  let stopped: string | null = null;
  for (const c of WRITING_GOLDEN) {
    current = c;
    try {
      await runWritingCase(c, transport, deployment || EVAL_MODEL);
    } catch (error) {
      if (!(error instanceof BudgetStop)) throw error;
      stopped = error.caseId;
      break;
    }
  }
  if (!yes) {
    console.log(
      `${calls} calls to record, worst case US$${(planned / 1e6).toFixed(4)}; ` +
        `a run spends at most US$${limit.toFixed(2)}. Dry run: nothing called.`,
    );
    return;
  }
  console.log(
    `Recorded ${calls} calls: ${usage.inputTokens} in / ${usage.outputTokens} out tokens, ` +
      `US$${(spent / 1e6).toFixed(6)} (limit US$${limit.toFixed(2)}).` +
      (stopped ? ` Stopped before ${stopped}: run again to go on.` : " Done."),
  );
});
