/**
 * Records the essay-rewrite golden set from the real model (D218): only
 * cases whose request changed (prompt or model) or that were never
 * recorded.
 *
 *   npm run eval:rewrite:record                 # dry run: calls and worst case
 *   AI_RECORD_YES=1 npm run eval:rewrite:record # records (Joe's go-ahead)
 *
 * One run spends at most REWRITE_EVAL_BUDGET_USD (EVAL_LIMIT_USD can lower
 * it): before each call, what was spent plus that call's worst case must
 * fit, or it stops. Each call goes to api_calls as "eval:rewrite".
 */
import { createClient } from "@supabase/supabase-js";
import { expect, it } from "vitest";
import {
  azureEndpoint,
  azureModelPrice,
  azureUsage,
} from "@/lib/ai/azure-openai";
import { maxCost, rewriteBudget } from "@/lib/ai/budgets";
import { toMicros } from "@/lib/ai/pricing";
import { EVAL_MODEL } from "@/lib/evals/config";
import { requestHash } from "@/lib/evals/run";
import {
  rewriteInputOf,
  runRewriteCase,
  type RewriteTransport,
} from "@/lib/writing/rewrite/eval";
import {
  REWRITE_GOLDEN,
  type RewriteEvalCase,
} from "@/lib/writing/rewrite/golden";
import { loadRewriteFixture, saveRewriteFixture } from "./rewrite-eval-files";

const REWRITE_EVAL_BUDGET_USD = 0.2;

class BudgetStop extends Error {
  constructor(readonly caseId: string) {
    super(`budget reached before ${caseId}`);
    this.name = "BudgetStop";
  }
}

const env = (name: string) => process.env[name]?.trim() ?? "";
const price = azureModelPrice(EVAL_MODEL)!;
// The worst case of a case's costliest call (an adjust also sends the
// version it adjusts, about as long as the essay).
const worstCase = (c: RewriteEvalCase) => {
  const input = rewriteInputOf(c, "natural");
  return toMicros(
    maxCost(rewriteBudget({ ...input, original: input.sentences }), price),
  );
};

it("records the essay-rewrite golden set", async () => {
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
      ? Math.min(asked, REWRITE_EVAL_BUDGET_USD)
      : REWRITE_EVAL_BUDGET_USD;
  const cap = toMicros(limit);
  const supabase =
    yes && env("NEXT_PUBLIC_SUPABASE_URL") && env("SUPABASE_SERVICE_ROLE_KEY")
      ? createClient(
          env("NEXT_PUBLIC_SUPABASE_URL"),
          env("SUPABASE_SERVICE_ROLE_KEY"),
          {
            auth: { persistSession: false },
          },
        )
      : null;

  let spent = 0;
  let planned = 0;
  let calls = 0;
  const usage = { inputTokens: 0, outputTokens: 0 };
  let current = REWRITE_GOLDEN[0];

  const transport: RewriteTransport = async (caseId, body) => {
    const recorded = loadRewriteFixture(caseId);
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
    saveRewriteFixture(caseId, {
      requestHash: requestHash(body),
      request: body,
      ...(response.status === 200 ? {} : { status: response.status }),
      response: data,
    });
    await supabase?.from("api_calls").insert({
      user_id: null,
      provider: `azure-openai/${EVAL_MODEL}`,
      operation: "eval:rewrite",
      http_status: response.status,
      error: response.status === 200 ? null : "failed",
      input_tokens: used.inputTokens,
      output_tokens: used.outputTokens,
      chars: 0,
      cost_micros: toMicros(used.costUsd),
    });
    console.log(
      `${caseId}: ${used.inputTokens} in / ${used.outputTokens} out, US$${used.costUsd.toFixed(6)}`,
    );
    return { status: response.status, response: data };
  };

  if (yes)
    expect(
      endpoint && deployment && apiKey,
      "Azure OpenAI settings",
    ).toBeTruthy();
  let stopped: string | null = null;
  for (const c of REWRITE_GOLDEN) {
    current = c;
    try {
      await runRewriteCase(c, transport, deployment || EVAL_MODEL);
    } catch (error) {
      if (!(error instanceof BudgetStop)) throw error;
      stopped = error.caseId;
      break;
    }
  }
  if (!yes) {
    // A dry run's "natural" fails, so the easier and harder calls made
    // from it weren't counted: add them (unless already recorded).
    for (const c of REWRITE_GOLDEN.filter((x) => x.adjust)) {
      for (const step of ["easier", "harder"]) {
        if (!loadRewriteFixture(`${c.id}.${step}`)) {
          planned += worstCase(c);
          calls += 1;
        }
      }
    }
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
