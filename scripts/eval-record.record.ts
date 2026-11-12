/**
 * Records the golden set's answers and grades from the real model (D150):
 * only the cases whose request changed (prompt, model, or the processed
 * answer the judge reads) or that were never recorded.
 *
 *   npm run eval:record                 # prints the calls and the worst case
 *   AI_RECORD_YES=1 npm run eval:record # makes them (with Joe's go-ahead)
 *
 * One run spends at most EVAL_BUDGET_USD (lib/evals/config.ts): before
 * each call, what was spent plus that call's worst case must fit, or the
 * run stops (run it again to go on). Each call is added to api_calls as
 * "eval:<step>", so /admin/usage shows it. Then run `npm run eval`.
 */
import { createClient } from "@supabase/supabase-js";
import { expect, it } from "vitest";
import {
  azureEndpoint,
  azureModelPrice,
  azureUsage,
} from "@/lib/ai/azure-openai";
import {
  annotateBudget,
  composeBudget,
  describeBudget,
  maxCost,
  reviseBudget,
  segmentBudget,
  translateBudget,
  type LanguageBudget,
} from "@/lib/ai/budgets";
import { tokenCost, toMicros } from "@/lib/ai/pricing";
import { EVAL_BUDGET_USD, EVAL_MODEL } from "@/lib/evals/config";
import { GOLDEN_SET } from "@/lib/evals/golden";
import { JUDGE_MAX_OUTPUT_TOKENS } from "@/lib/evals/judge";
import {
  BudgetStop,
  requestHash,
  runCase,
  type Transport,
} from "@/lib/evals/run";
import type { EvalCase } from "@/lib/evals/types";
import { loadFixture, saveFixture } from "./eval-files";

const env = (name: string) => process.env[name]?.trim() ?? "";

function answerBudget(evalCase: EvalCase): LanguageBudget {
  switch (evalCase.operation) {
    case "translate":
      return translateBudget(evalCase.input.lines);
    case "segment":
      return segmentBudget(evalCase.input.lines);
    case "annotate":
      return annotateBudget(evalCase.input.sentences);
    case "compose":
      return composeBudget(evalCase.input);
    case "describe":
      return describeBudget(evalCase.input);
    case "revise":
      return reviseBudget(evalCase.input);
  }
}

const price = azureModelPrice(EVAL_MODEL)!;

/** The most one request can cost, in micro-dollars (errs high). */
function worstCase(evalCase: EvalCase, step: string, body: unknown): number {
  if (step === "answer")
    return toMicros(maxCost(answerBudget(evalCase), price));
  if (step === "shorten") {
    // Every character sent counted as a token, plus the request's cap.
    const cap = (body as { max_completion_tokens?: number })
      .max_completion_tokens;
    return toMicros(
      tokenCost(price, JSON.stringify(body).length, cap ?? 4_000),
    );
  }
  // The judge: every character sent counted as a token, plus the cap.
  return toMicros(
    tokenCost(price, JSON.stringify(body).length, JUDGE_MAX_OUTPUT_TOKENS),
  );
}

it("records the golden set", async () => {
  // Never in an unattended run (scripts/auto-continue/run.sh, D65).
  expect(env("LISTENLOOP_UNATTENDED"), "no paid calls unattended").not.toBe(
    "1",
  );
  expect(
    env("AZURE_OPENAI_MODEL"),
    "the eval is recorded with production's model (EVAL_MODEL)",
  ).toBe(EVAL_MODEL);
  const endpoint = azureEndpoint(env("AZURE_OPENAI_ENDPOINT"));
  const deployment = env("AZURE_OPENAI_DEPLOYMENT");
  const apiKey = env("AZURE_OPENAI_API_KEY");
  const yes = env("AI_RECORD_YES") === "1";
  // A lower limit Joe approved for this run (D153); never a higher one.
  const asked = Number(env("EVAL_LIMIT_USD"));
  const limitUsd =
    asked > 0 ? Math.min(asked, EVAL_BUDGET_USD) : EVAL_BUDGET_USD;
  const cap = toMicros(limitUsd);

  const supabase =
    yes && env("NEXT_PUBLIC_SUPABASE_URL") && env("SUPABASE_SERVICE_ROLE_KEY")
      ? createClient(
          env("NEXT_PUBLIC_SUPABASE_URL"),
          env("SUPABASE_SERVICE_ROLE_KEY"),
          { auth: { persistSession: false } },
        )
      : null;

  let spent = 0;
  let worstPlanned = 0;
  let calls = 0;
  const usage = { inputTokens: 0, outputTokens: 0 };
  let current: EvalCase = GOLDEN_SET[0];

  const transport: Transport = async (caseId, step, body) => {
    const recorded = loadFixture(caseId, step);
    if (recorded && recorded.requestHash === requestHash(body)) {
      return { status: recorded.status ?? 200, response: recorded.response };
    }
    const worst = worstCase(current, step, body);
    if (!yes) {
      // A dry run: count it, and answer as if refused so the judge isn't asked.
      worstPlanned += worst;
      calls += 1;
      return { status: 400, response: { error: { code: "dry-run" } } };
    }
    if (spent + worst > cap) throw new BudgetStop(caseId, step);
    const response = await fetch(`${endpoint}/openai/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", "api-key": apiKey },
      body: JSON.stringify(body),
    });
    const data = (await response.json()) as Parameters<typeof azureUsage>[0];
    const used = azureUsage(data, price, 0);
    spent += toMicros(used.costUsd);
    calls += 1;
    usage.inputTokens += used.inputTokens;
    usage.outputTokens += used.outputTokens;
    saveFixture(caseId, step, {
      requestHash: requestHash(body),
      request: body,
      ...(response.status === 200 ? {} : { status: response.status }),
      response: data,
    });
    const operation = `eval:${step === "answer" ? current.operation : step}`;
    await supabase?.from("api_calls").insert({
      user_id: null,
      provider: `azure-openai/${EVAL_MODEL}`,
      operation,
      http_status: response.status,
      error: response.status === 200 ? null : "failed",
      input_tokens: used.inputTokens,
      output_tokens: used.outputTokens,
      chars: 0,
      cost_micros: toMicros(used.costUsd),
    });
    console.log(
      `${caseId} ${step}: ${used.inputTokens} in / ${used.outputTokens} out tokens, US$${used.costUsd.toFixed(6)}`,
    );
    return { status: response.status, response: data };
  };

  if (yes) {
    expect(
      endpoint && deployment && apiKey,
      "Azure OpenAI settings",
    ).toBeTruthy();
  }
  let stoppedAt: string | null = null;
  for (const evalCase of GOLDEN_SET) {
    current = evalCase;
    try {
      await runCase(evalCase, transport, deployment || EVAL_MODEL);
    } catch (error) {
      if (!(error instanceof BudgetStop)) throw error;
      stoppedAt = `${error.caseId} (${error.step})`;
      break;
    }
  }

  if (!yes) {
    console.log(
      `${calls} answers to record (judging follows each), worst case US$${(worstPlanned / 1e6).toFixed(4)} ` +
        `for the answers; one run spends at most US$${limitUsd.toFixed(2)}. ` +
        "Dry run: nothing called. Set AI_RECORD_YES=1 to record.",
    );
    return;
  }
  console.log(
    `Recorded ${calls} calls: ${usage.inputTokens} in / ${usage.outputTokens} out tokens, ` +
      `US$${(spent / 1e6).toFixed(6)} (limit US$${limitUsd.toFixed(2)}).` +
      (stoppedAt
        ? ` Stopped before ${stoppedAt} to stay within the limit: run again to go on.`
        : " Done: now run `npm run eval`."),
  );
});
