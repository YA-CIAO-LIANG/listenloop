/**
 * Records one real answer of each paid call as test fixtures
 * (tests/fixtures/ai/), with the shortest content, so tests replay them
 * instead of calling again (CLAUDE.md, "AI 供應者與測試"; D41):
 *
 *   npm run ai:record                 # prints the calls and the worst-case cost
 *   AI_RECORD_YES=1 npm run ai:record # makes the calls (with Joe's go-ahead)
 *
 * A fixture that already exists is kept, and its call skipped, unless
 * AI_RECORD_FORCE=1. Reads the Azure keys from .env.local. Each call made
 * is also added to api_calls (no user) when the Supabase secret key is
 * set, so /admin/usage counts it against the credit.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { expect, it } from "vitest";
import { azureOpenAiLanguage } from "@/lib/ai/azure-openai";
import { azureSpeech } from "@/lib/ai/azure-speech";
import {
  annotateBudget,
  composeBudget,
  maxCost,
  segmentBudget,
  translateBudget,
  type LanguageBudget,
} from "@/lib/ai/budgets";
import { toMicros } from "@/lib/ai/pricing";
import type { Billed, CallUsage, Voice } from "@/lib/ai/types";
import {
  GENERATION_LEVELS,
  type CompositionPrompt,
} from "@/lib/custom-practice/generation";
import { countChars } from "@/lib/usage";

export const FIXTURE_DIR = join(process.cwd(), "tests", "fixtures", "ai");

const translateInput = ["你好，很高興認識你。"];
const annotateInput = ["Nice to meet you, too."];
const segmentInput = ["I missed the bus. So I walked to school."];
const composeInput: CompositionPrompt = {
  topic: "",
  scenario: "ordering a drink at a coffee shop",
  level: GENERATION_LEVELS.beginner,
  words: 40,
  format: "dialogue",
};
const speechInput = "Nice to meet you.";
const speechVoice: Voice = { accent: "us", gender: "female" };

type Exchange = { request: unknown; response: unknown };

/** A fetch that keeps what was sent (without headers, so no key) and got. */
function recordingFetch() {
  const exchanges: Exchange[] = [];
  const audio: Uint8Array[] = [];
  const impl: typeof fetch = async (input, init) => {
    const response = await fetch(input, init);
    const copy = response.clone();
    const body = typeof init?.body === "string" ? init.body : "";
    const type = response.headers.get("content-type") ?? "";
    if (type.includes("json")) {
      exchanges.push({
        request: body.startsWith("{") ? JSON.parse(body) : body,
        response: await copy.json(),
      });
    } else {
      exchanges.push({ request: body, response: { status: response.status } });
      audio.push(new Uint8Array(await copy.arrayBuffer()));
    }
    return response;
  };
  return { impl, exchanges, audio };
}

const env = (name: string) => process.env[name]?.trim() ?? "";

it("records the Azure fixtures", async () => {
  const model = env("AZURE_OPENAI_MODEL");
  const recorder = recordingFetch();
  const language = azureOpenAiLanguage(
    {
      endpoint: env("AZURE_OPENAI_ENDPOINT"),
      apiKey: env("AZURE_OPENAI_API_KEY"),
      deployment: env("AZURE_OPENAI_DEPLOYMENT"),
      model,
    },
    recorder.impl,
  );
  const speech = azureSpeech(
    env("AZURE_SPEECH_KEY"),
    env("AZURE_SPEECH_REGION"),
    recorder.impl,
  );

  const calls: {
    file: string;
    budget?: LanguageBudget;
    chars: number;
    run: () => Promise<Billed<unknown>>;
  }[] = [
    {
      file: "azure-openai/translate.json",
      budget: translateBudget(translateInput),
      chars: countChars(translateInput),
      run: () =>
        language.translate(translateInput, { from: "zh-Hant", to: "en" }),
    },
    {
      file: "azure-openai/annotate.json",
      budget: annotateBudget(annotateInput),
      chars: countChars(annotateInput),
      run: () => language.annotate(annotateInput),
    },
    {
      file: "azure-openai/segment.json",
      budget: segmentBudget(segmentInput),
      chars: countChars(segmentInput),
      run: () => language.segment(segmentInput, "en"),
    },
    {
      file: "azure-openai/compose.json",
      budget: composeBudget(composeInput),
      chars: 0,
      run: () => language.compose(composeInput),
    },
    {
      file: "azure-speech/us-female.json",
      chars: countChars([speechInput]),
      run: () => speech.synthesize(speechInput, speechVoice),
    },
  ];

  const force = env("AI_RECORD_FORCE") === "1";
  const todo = calls.filter(
    (call) => force || !existsSync(join(FIXTURE_DIR, call.file)),
  );
  const worst = todo.reduce(
    (sum, call) =>
      sum + (call.budget ? toMicros(maxCost(call.budget, language.price)) : 0),
    0,
  );
  console.log(
    `${todo.length} calls to make (${calls.length - todo.length} already recorded): ` +
      `${todo.filter((c) => c.budget).length} Azure OpenAI (${model}), worst case US$${(worst / 1e6).toFixed(4)}; ` +
      `${todo.filter((c) => !c.budget).length} Azure Speech, ${todo
        .filter((c) => !c.budget)
        .reduce((sum, c) => sum + c.chars, 0)} characters (free on F0).`,
  );
  if (env("AI_RECORD_YES") !== "1") {
    console.log("Dry run: nothing called. Set AI_RECORD_YES=1 to record.");
    return;
  }

  const supabase =
    env("NEXT_PUBLIC_SUPABASE_URL") && env("SUPABASE_SERVICE_ROLE_KEY")
      ? createClient(
          env("NEXT_PUBLIC_SUPABASE_URL"),
          env("SUPABASE_SERVICE_ROLE_KEY"),
          { auth: { persistSession: false } },
        )
      : null;
  const used: CallUsage[] = [];
  for (const call of todo) {
    const before = recorder.exchanges.length;
    const { usage } = await call.run();
    used.push(usage);
    const exchange = recorder.exchanges[before];
    const path = join(FIXTURE_DIR, call.file);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, JSON.stringify(exchange, null, 2) + "\n");
    if (!call.budget) {
      writeFileSync(path.replace(/\.json$/, ".mp3"), recorder.audio.at(-1)!);
    }
    await supabase?.from("api_calls").insert({
      user_id: null,
      provider: call.budget ? language.id : speech.id,
      operation: call.budget?.operation ?? "speech",
      error: null,
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      chars: usage.chars || call.chars,
      cost_micros: toMicros(usage.costUsd),
    });
    console.log(
      `${call.file}: ${usage.inputTokens} in / ${usage.outputTokens} out tokens, ` +
        `${usage.chars} chars, US$${usage.costUsd.toFixed(6)}`,
    );
  }
  const total = used.reduce(
    (sum, u) => ({
      inputTokens: sum.inputTokens + u.inputTokens,
      outputTokens: sum.outputTokens + u.outputTokens,
      chars: sum.chars + u.chars,
      costUsd: sum.costUsd + u.costUsd,
    }),
    { inputTokens: 0, outputTokens: 0, chars: 0, costUsd: 0 },
  );
  console.log(
    `Total: ${total.inputTokens} in / ${total.outputTokens} out tokens, ` +
      `${total.chars} chars, US$${total.costUsd.toFixed(6)}`,
  );
  expect(used.length).toBe(todo.length);
});
