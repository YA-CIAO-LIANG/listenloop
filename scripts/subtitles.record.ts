/**
 * Writes the library-card subtitles (D71) of the 14 official sample
 * drafts (D59) with the real provider, one short call each. Drafts that
 * already have a subtitle are skipped, so a stopped run can be started
 * again.
 *
 *   npm run subtitles:record                    # prints the plan and estimate
 *   SUBTITLES_YES=1 npm run subtitles:record    # writes (Joe's go-ahead)
 *
 * The first call's exchange is saved as the describe fixture
 * (tests/fixtures/ai/azure-openai/describe.json), so tests replay what
 * Azure really sends without an extra call.
 *
 * Cost guard: every call reserves its worst case first, and the run stops
 * before it could pass BUDGET_USD. Every call is logged.
 */
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, it } from "vitest";
import { supabaseUsageMeter } from "@/auth/creator";
import { azureOpenAiLanguage } from "@/lib/ai/azure-openai";
import { describeBudget, maxCost } from "@/lib/ai/budgets";
import { meteredLanguage } from "@/lib/ai/metered";
import { toMicros } from "@/lib/ai/pricing";
import { getAiProviders } from "@/lib/ai/providers";
import {
  describeInput,
  subtitleFromModel,
} from "@/lib/custom-practice/subtitle";
import type { Database } from "@/lib/supabase/database.types";
import { OFFICIAL_DAILY_LIMITS } from "@/lib/usage";
import { emptyTally, guardedMeter, usd } from "./cost-guard";
import { DRAFT_IDS } from "./draft-ids";

/** Joe approved about US$0.003 for this (2026-11-08); a guard well above. */
const BUDGET_USD = 0.05;

const FIXTURE = "tests/fixtures/ai/azure-openai/describe.json";

const env = (name: string) => process.env[name]?.trim() ?? "";

it("writes the official drafts' subtitles", { timeout: 600_000 }, async () => {
  // Never in an unattended run (scripts/auto-continue/run.sh, D65).
  expect(env("LISTENLOOP_UNATTENDED"), "no paid calls unattended").not.toBe(
    "1",
  );
  const providers = getAiProviders(process.env);
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  expect(providers, "AI providers configured in .env.local").not.toBeNull();
  expect(url && key, "Supabase URL and secret key in .env.local").toBeTruthy();
  const admin = createClient<Database>(url, key, {
    auth: { persistSession: false },
  });

  const { data: practices, error } = await admin
    .from("practices")
    .select("id, title, subtitle, user_id, practice_sentences(i, en)")
    .in("id", DRAFT_IDS)
    .order("created_at");
  if (error) throw new Error(error.message);
  const todo = (practices ?? []).filter((p) => !p.subtitle);
  const inputs = todo.map((p) =>
    describeInput(
      p.title,
      [...p.practice_sentences].sort((a, b) => a.i - b.i).map((s) => s.en),
    ),
  );
  const price = providers!.language.price;
  const worst = inputs.reduce(
    (sum, input) => sum + toMicros(maxCost(describeBudget(input), price)),
    0,
  );
  console.log(
    `${todo.length} subtitles to write; expected about US$${(todo.length * 0.0003).toFixed(4)}, worst case ${usd(worst)}; budget ${usd(toMicros(BUDGET_USD))}`,
  );
  if (env("SUBTITLES_YES") !== "1") {
    console.log("Dry run. Set SUBTITLES_YES=1 to write them.");
    return;
  }

  const total = emptyTally();
  let recorded: { request: unknown; response: unknown } | null = null;
  const recording: typeof fetch = async (input, init) => {
    const response = await fetch(input, init);
    if (!recorded) {
      recorded = {
        request: JSON.parse(init?.body as string),
        response: await response.clone().json(),
      };
    }
    return response;
  };
  const language = azureOpenAiLanguage(
    {
      endpoint: env("AZURE_OPENAI_ENDPOINT"),
      apiKey: env("AZURE_OPENAI_API_KEY"),
      deployment: env("AZURE_OPENAI_DEPLOYMENT").toLowerCase(),
      model: env("AZURE_OPENAI_MODEL").toLowerCase(),
    },
    recording,
  );

  for (const [k, practice] of todo.entries()) {
    const tally = { current: emptyTally(), total };
    const meter = guardedMeter(
      supabaseUsageMeter(
        admin,
        practice.user_id,
        () => new Date(),
        OFFICIAL_DAILY_LIMITS,
      ),
      tally,
      BUDGET_USD,
    );
    const input = inputs[k];
    const result = await meteredLanguage(
      { providers: { ...providers!, language }, meter },
      describeBudget(input),
      () => language.describe(input),
    );
    const subtitle = result.ok ? subtitleFromModel(result.value) : null;
    if (!subtitle) {
      console.log(
        `stop at "${practice.title}": ${result.ok ? "unusable answer" : result.reason}`,
      );
      break;
    }
    const { error: writeError } = await admin
      .from("practices")
      .update({ subtitle })
      .eq("id", practice.id);
    if (writeError) throw new Error(writeError.message);
    if (k === 0 && recorded) {
      writeFileSync(FIXTURE, JSON.stringify(recorded, null, 2) + "\n");
    }
    console.log(
      `  ✓ ${practice.title}\t${subtitle}\tin ${tally.current.inputTokens} / out ${tally.current.outputTokens}\t${usd(tally.current.micros)}`,
    );
  }
  console.log(
    `TOTAL\tin ${total.inputTokens} / out ${total.outputTokens} tokens\t${usd(total.micros)}\t${total.calls} calls`,
  );
});
