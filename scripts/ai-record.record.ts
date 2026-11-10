/**
 * Records one real answer of each paid call as test fixtures
 * (tests/fixtures/ai/), with the shortest content, so tests replay them
 * instead of calling again (CLAUDE.md, "AI 供應者與測試"; D41):
 *
 *   npm run ai:record                 # prints the calls and the worst-case cost
 *   AI_RECORD_YES=1 npm run ai:record # makes the calls (with Joe's go-ahead)
 *
 * A fixture that already exists is kept, and its call skipped, unless
 * AI_RECORD_FORCE=1; AI_RECORD_ONLY=compose,describe re-records just those
 * (after their prompt changed, D83). Reads the Azure keys from .env.local. Each call made
 * is also added to api_calls (no user) when the Supabase secret key is
 * set, so /admin/usage counts it against the credit.
 */
import { LEVEL_PROMPTS } from "@/lib/categories";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { expect, it } from "vitest";
import {
  azureEndpoint,
  azureModelPrice,
  azureOpenAiLanguage,
  azureUsage,
} from "@/lib/ai/azure-openai";
import { azureSpeech } from "@/lib/ai/azure-speech";
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
import { toMicros } from "@/lib/ai/pricing";
import type {
  Billed,
  CallUsage,
  DescribeInput,
  RevisionInput,
  Voice,
} from "@/lib/ai/types";
import { type CompositionPrompt } from "@/lib/custom-practice/generation";
import { countChars } from "@/lib/usage";

export const FIXTURE_DIR = join(process.cwd(), "tests", "fixtures", "ai");

const translateInput = ["你好，很高興認識你。"];
const annotateInput = [
  "If you're going to the library later, could you pick up the book I reserved for my history class?",
];
const segmentInput = ["I missed the bus. So I walked to school."];
const composeInput: CompositionPrompt = {
  topic: "",
  scenario: "ordering a drink at a coffee shop",
  level: LEVEL_PROMPTS.beginner,
  words: 40,
  format: "dialogue",
};
const describeInput: DescribeInput = {
  title: "",
  text: "Hi, can I help you? Yes, please. I'd like a latte. What size would you like? A small one, please.",
};
/**
 * The case behind D123: a 7-sentence text and "改成恐怖風", which the D96
 * prompt answered with the text unchanged ("0 of 7 changed").
 */
const reviseInput: RevisionInput = {
  lines: [
    "After school, I walked home through the park.",
    "The sun was going down, and the air was cool.",
    "I stopped at a small shop to buy a hot drink.",
    "The owner smiled and asked about my day.",
    "I told her I had a big test tomorrow.",
    "She said I would do fine if I got some sleep.",
    "I went home, studied a little, and went to bed early.",
  ],
  instruction: "改成恐怖風",
  format: "monologue",
};

/** The D96 prompt and answer shape, kept to replay what went wrong. */
const REVISE_INSTRUCTIONS_D96 = [
  "You edit an English listening practice text for Taiwanese students. You get its sentences as lines, an instruction from the learner (in any language), and whether it's a monologue or a dialogue.",
  "Follow the instruction: for example simpler words, more past tense, or fewer sentences. Change only what the instruction needs.",
  "Return lines: the whole text after the change, one sentence per line (for a dialogue, one speaker's turn per line, still alternating between two people, with no speaker names or labels).",
  "Copy every sentence you don't need to change exactly, character for character, so it can be matched to its translation.",
  "Keep each sentence about 5 to 25 words. Do not write about real people, real brands, or real current events. If the instruction asks for anything unsafe or unrelated to the text, return the lines unchanged.",
].join("\n");

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
  // Never in an unattended run (scripts/auto-continue/run.sh, D65).
  expect(env("LISTENLOOP_UNATTENDED"), "no paid calls unattended").not.toBe(
    "1",
  );
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
      file: "azure-openai/describe.json",
      budget: describeBudget(describeInput),
      chars: 0,
      run: () => language.describe(describeInput),
    },
    {
      // D123: the old prompt, to show it left the text unchanged.
      file: "azure-openai/revise-d96.json",
      budget: reviseBudget(reviseInput),
      chars: 0,
      run: async () => {
        const response = await recorder.impl(
          `${azureEndpoint(env("AZURE_OPENAI_ENDPOINT"))}/openai/v1/chat/completions`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "api-key": env("AZURE_OPENAI_API_KEY"),
            },
            body: JSON.stringify({
              model: env("AZURE_OPENAI_DEPLOYMENT"),
              messages: [
                { role: "system", content: REVISE_INSTRUCTIONS_D96 },
                { role: "user", content: JSON.stringify(reviseInput) },
              ],
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: "revision",
                  strict: true,
                  schema: {
                    type: "object",
                    properties: {
                      lines: { type: "array", items: { type: "string" } },
                    },
                    required: ["lines"],
                    additionalProperties: false,
                  },
                },
              },
              max_completion_tokens: reviseBudget(reviseInput).maxOutputTokens,
              reasoning_effort: "minimal",
            }),
          },
        );
        const data = await response.json();
        return {
          value: data,
          usage: azureUsage(
            data,
            azureModelPrice(model)!,
            reviseBudget(reviseInput).inputChars,
          ),
        };
      },
    },
    {
      file: "azure-openai/revise.json",
      budget: reviseBudget(reviseInput),
      chars: 0,
      run: () => language.revise(reviseInput),
    },
    {
      file: "azure-speech/us-female.json",
      chars: countChars([speechInput]),
      run: () => speech.synthesize(speechInput, speechVoice),
    },
  ];

  const force = env("AI_RECORD_FORCE") === "1";
  const only = env("AI_RECORD_ONLY").split(",").filter(Boolean);
  const todo = calls.filter((call) =>
    only.length > 0
      ? only.some((name) => call.file.endsWith(`/${name}.json`))
      : force || !existsSync(join(FIXTURE_DIR, call.file)),
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
