import { createHash } from "node:crypto";
import {
  azureOpenAiLanguage,
  azureUsage,
  completionJson,
  azureModelPrice,
} from "@/lib/ai/azure-openai";
import { ProviderError, type CallUsage } from "@/lib/ai/types";
import { EVAL_MODEL, EVAL_WEIGHTS, JUDGE_VERSION } from "./config";
import { judgeRequestBody, parseGrade } from "./judge";
import { shortenIfLong } from "@/lib/custom-practice/shorten";
import { processAnswer, shownAnswer, type Processed } from "./pipeline";
import { checkRules } from "./rules";
import type {
  CaseResult,
  EvalBaseline,
  EvalCase,
  EvalFixture,
  JudgeGrade,
} from "./types";

/**
 * Runs the golden set (D150) through the real provider code, with a
 * fetch that either replays the recordings (every test and CI run) or
 * calls Azure and records (`npm run eval:record`, with Joe's go-ahead).
 */

/** Where requests go; the replay never reaches it. */
export const EVAL_ENDPOINT = "https://listenloop-eval.openai.azure.com";

/**
 * Which recording of a case: its answer, the shortening of a written
 * text that came out too long (D153), or the judge's grade.
 */
export type EvalStep = "answer" | "shorten" | "judge";

/**
 * A request's fingerprint: everything sent except the key and the
 * deployment's name (which only says where the model runs). A change to
 * the instructions, schema, model, or output cap changes it.
 */
export function requestHash(body: unknown): string {
  const rest = { ...(body as Record<string, unknown>) };
  delete rest.model;
  return createHash("sha256")
    .update(JSON.stringify({ ...rest, evalModel: EVAL_MODEL }))
    .digest("hex")
    .slice(0, 16);
}

/** Thrown when a case has no recording for its current request. */
export class MissingRecording extends Error {
  constructor(
    readonly caseId: string,
    readonly step: EvalStep,
  ) {
    super(`No recording of ${caseId} (${step}) for the current request`);
    this.name = "MissingRecording";
  }
}

/** Gets the answer for one request: replayed or really sent. */
export type Transport = (
  caseId: string,
  step: EvalStep,
  body: unknown,
) => Promise<{ status: number; response: unknown }>;

/** A transport from saved fixtures; a changed request has none. */
export function replayTransport(
  load: (caseId: string, step: EvalStep) => EvalFixture | null,
): Transport {
  return async (caseId, step, body) => {
    const fixture = load(caseId, step);
    if (!fixture || fixture.requestHash !== requestHash(body)) {
      throw new MissingRecording(caseId, step);
    }
    return { status: fixture.status ?? 200, response: fixture.response };
  };
}

/** A fetch for the provider code that goes through `transport`. */
function fetchFor(transport: Transport, caseId: string, step: EvalStep) {
  return (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as unknown;
    const { status, response } = await transport(caseId, step, body);
    return new Response(JSON.stringify(response), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

const price = azureModelPrice(EVAL_MODEL)!;

function provider(fetchImpl: typeof fetch, deployment: string) {
  return azureOpenAiLanguage(
    { endpoint: EVAL_ENDPOINT, apiKey: "eval", deployment, model: EVAL_MODEL },
    fetchImpl,
  );
}

/** The provider's raw value for a case (what production would check). */
async function callProvider(
  evalCase: EvalCase,
  fetchImpl: typeof fetch,
  deployment: string,
) {
  const language = provider(fetchImpl, deployment);
  switch (evalCase.operation) {
    case "translate": {
      const { lines, from, to } = evalCase.input;
      return language.translate(lines, { from, to });
    }
    case "segment":
      return language.segment(evalCase.input.lines, evalCase.input.language);
    case "annotate":
      return language.annotate(evalCase.input.sentences);
    case "compose":
      return language.compose(evalCase.input);
    case "describe":
      return language.describe(evalCase.input);
    case "revise":
      return language.revise(evalCase.input);
  }
}

const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

/** Two calls' usage together. */
function addUsage(a: CallUsage | null, b: CallUsage | null): CallUsage | null {
  if (!a || !b) return a ?? b;
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    chars: a.chars + b.chars,
    costUsd: a.costUsd + b.costUsd,
  };
}

/** A refusal by the provider's safety system counts as "refused" (D123). */
function filtered(error: unknown): boolean {
  return (
    error instanceof ProviderError &&
    (error.code === "filtered" || error.detail.code === "content_filter")
  );
}

/** A case's answer, processed as production would. */
async function answer(
  evalCase: EvalCase,
  transport: Transport,
  deployment: string,
): Promise<{ processed: Processed; usage: CallUsage | null }> {
  try {
    const { value, usage } = await callProvider(
      evalCase,
      fetchFor(transport, evalCase.id, "answer"),
      deployment,
    );
    const processed = processAnswer(evalCase, value);
    if (
      evalCase.operation === "compose" &&
      processed.operation === "compose" &&
      processed.text
    ) {
      // As production does (app/materials/actions.ts, D153).
      const first = processed.text;
      let extra: CallUsage | null = null;
      const text = await shortenIfLong(first, evalCase.input, async (input) => {
        const language = provider(
          fetchFor(transport, evalCase.id, "shorten"),
          deployment,
        );
        try {
          const result = await language.revise(input);
          extra = result.usage;
          return result.value;
        } catch (error) {
          if (error instanceof ProviderError) extra = error.usage ?? null;
          throw error;
        }
      });
      const shortened = text !== first || extra !== null;
      return {
        processed: {
          ...processed,
          text,
          ...(shortened ? { firstWords: words(first.text) } : {}),
        },
        usage: addUsage(usage, extra),
      };
    }
    return { processed, usage };
  } catch (error) {
    const usage = error instanceof ProviderError ? (error.usage ?? null) : null;
    if (evalCase.operation === "revise" && filtered(error)) {
      return {
        processed: {
          operation: "revise",
          revision: { status: "refused", reason: "（內容過濾）" },
        },
        usage,
      };
    }
    return { processed: processAnswer(evalCase, undefined), usage };
  }
}

/** The judge's grade of a processed answer. */
async function grade(
  evalCase: EvalCase,
  output: unknown,
  transport: Transport,
  deployment: string,
): Promise<{ grade: JudgeGrade | null; usage: CallUsage | null }> {
  const body = judgeRequestBody(deployment, {
    operation: evalCase.operation,
    input: evalCase.input,
    output,
    criteria: evalCase.judge ?? "",
  });
  const { status, response } = await transport(evalCase.id, "judge", body);
  if (status !== 200) return { grade: null, usage: null };
  const completion = response as Parameters<typeof azureUsage>[0];
  const usage = azureUsage(completion, price, 0);
  try {
    return { grade: parseGrade(completionJson(completion, usage)), usage };
  } catch {
    return { grade: null, usage };
  }
}

/** A case's score out of 100 from its rules and grade. */
export function caseScore(
  rules: { pass: boolean }[],
  judge: JudgeGrade | null,
  judged: boolean,
): number {
  const ruleShare =
    rules.length === 0 ? 1 : rules.filter((r) => r.pass).length / rules.length;
  if (!judged) return Math.round(ruleShare * 10000) / 100;
  const judgeShare = judge ? (judge.score - 1) / 4 : 0;
  const score =
    ruleShare * EVAL_WEIGHTS.rules + judgeShare * EVAL_WEIGHTS.judge;
  return Math.round(score * 100) / 100;
}

/** Runs one case: answer, rules, and (when it has criteria) the judge. */
export async function runCase(
  evalCase: EvalCase,
  transport: Transport,
  deployment = EVAL_MODEL,
): Promise<CaseResult> {
  // The fingerprint of each request made, saved with the result.
  const seen: Partial<Record<EvalStep, string>> = {};
  // The provider code turns a failed fetch into its own error; a missing
  // recording (or the budget running out) must stop the run instead.
  let stopped: MissingRecording | null = null;
  const watched: Transport = async (caseId, step, body) => {
    seen[step] = requestHash(body);
    try {
      return await transport(caseId, step, body);
    } catch (error) {
      if (error instanceof MissingRecording) stopped = error;
      throw error;
    }
  };
  const { processed, usage } = await answer(evalCase, watched, deployment);
  if (stopped) throw stopped;
  const output = shownAnswer(processed);
  const rules = checkRules(evalCase, processed);
  // Nothing usable to grade: the judge part scores 0, with no call.
  const usable = rules.find((r) => r.kind === "valid")?.pass !== false;
  const judged =
    evalCase.judge && usable
      ? await grade(evalCase, output, watched, deployment)
      : { grade: null, usage: null };
  return {
    id: evalCase.id,
    operation: evalCase.operation,
    output,
    rules,
    judge: judged.grade,
    score: caseScore(rules, judged.grade, Boolean(evalCase.judge)),
    requestHash: [seen.answer, seen.shorten, seen.judge]
      .filter(Boolean)
      .join(":"),
    costUsd: (usage?.costUsd ?? 0) + (judged.usage?.costUsd ?? 0),
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const mean = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

/** The baseline saved for a run: totals, per operation, per case. */
export function baselineOf(results: CaseResult[]): EvalBaseline {
  const operations = [...new Set(results.map((r) => r.operation))];
  const version = createHash("sha256")
    .update(results.map((r) => `${r.id}:${r.requestHash}`).join("\n"))
    .digest("hex")
    .slice(0, 12);
  return {
    version,
    judgeVersion: JUDGE_VERSION,
    model: EVAL_MODEL,
    total: round2(mean(results.map((r) => r.score))),
    byOperation: Object.fromEntries(
      operations.map((op) => [
        op,
        round2(
          mean(results.filter((r) => r.operation === op).map((r) => r.score)),
        ),
      ]),
    ),
    cases: results.map((r) => ({
      id: r.id,
      score: r.score,
      requestHash: r.requestHash,
    })),
  };
}

/** An accepted drop in score, with why (evals/exceptions.json). */
export type EvalException = {
  version: string;
  date: string;
  reason: string;
  decision: string;
};

/** Whether a new run may merge (D150), and why not when it may not. */
export type Gate = { ok: true; note: string } | { ok: false; why: string };

export function gate(
  current: EvalBaseline,
  previous: EvalBaseline | null,
  exceptions: readonly EvalException[],
): Gate {
  if (!previous)
    return { ok: true, note: "main 還沒有基準，這次成為第一個基準" };
  if (current.total >= previous.total) {
    return {
      ok: true,
      note: `總分 ${current.total} ≥ main 的 ${previous.total}`,
    };
  }
  const exception = exceptions.find((e) => e.version === current.version);
  if (exception) {
    return {
      ok: true,
      note: `總分 ${current.total} < main 的 ${previous.total}，已記錄例外（${exception.decision}）：${exception.reason}`,
    };
  }
  return {
    ok: false,
    why: `總分 ${current.total} 低於 main 的 ${previous.total}。改進到不低於舊版，或在 evals/exceptions.json 記錄版本 ${current.version} 的例外與理由`,
  };
}

/** Thrown when the next recording could pass the eval's budget. */
export class BudgetStop extends MissingRecording {
  constructor(caseId: string, step: EvalStep) {
    super(caseId, step);
    this.message = `Stopped before ${caseId} (${step}): it could pass the eval budget`;
    this.name = "BudgetStop";
  }
}
