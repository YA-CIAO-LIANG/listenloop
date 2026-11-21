import { azureOpenAiLanguage } from "@/lib/ai/azure-openai";
import { EVAL_MODEL } from "@/lib/evals/config";
import { requestHash } from "@/lib/evals/run";
import { WRITING_PROMPT_VERSION, type WritingReviewInput } from "../prompts";
import { WRITING_TYPE_CONFIG } from "../types";
import { caseScore, checkAnswer, checkStable, type RuleResult } from "./rules";
import type { WritingEvalCase } from "./types";

/**
 * Running the writing eval (D188) through the production provider code
 * (lib/ai/azure-openai.ts), so the request is exactly what learners'
 * essays send. `transport` answers each request: from a recording
 * (replay, free) or the real API (recording, with Joe's go-ahead).
 */
export type WritingAttempt = "first" | "second";

/** The answer when the provider's safety filter refused the request. */
export const FILTERED = { filteredByProvider: true } as const;

export type WritingTransport = (
  caseId: string,
  attempt: WritingAttempt,
  body: unknown,
) => Promise<{ status: number; response: unknown }>;

export type WritingFixture = {
  requestHash: string;
  request: unknown;
  status?: number;
  response: unknown;
};

export class MissingWritingRecording extends Error {
  constructor(
    readonly caseId: string,
    readonly attempt: WritingAttempt,
  ) {
    super(`No recording of ${caseId} (${attempt}) for the current request`);
    this.name = "MissingWritingRecording";
  }
}

export function replayWriting(
  load: (caseId: string, attempt: WritingAttempt) => WritingFixture | null,
): WritingTransport {
  return async (caseId, attempt, body) => {
    const fixture = load(caseId, attempt);
    if (!fixture || fixture.requestHash !== requestHash(body)) {
      throw new MissingWritingRecording(caseId, attempt);
    }
    return { status: fixture.status ?? 200, response: fixture.response };
  };
}

const inputOf = (c: WritingEvalCase): WritingReviewInput => ({
  type: c.type,
  rubric: WRITING_TYPE_CONFIG[c.type].rubric,
  task: c.task,
  words: c.words,
  essay: c.essay,
});

async function ask(
  c: WritingEvalCase,
  attempt: WritingAttempt,
  transport: WritingTransport,
  deployment: string,
): Promise<unknown> {
  let transportError: unknown = null;
  const provider = azureOpenAiLanguage(
    {
      endpoint: "https://writing-eval.openai.azure.com",
      apiKey: "eval",
      deployment,
      model: EVAL_MODEL,
    },
    (async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as unknown;
      // The provider code wraps any fetch error as its own: keep the
      // transport's (a missing recording, a budget stop) to rethrow.
      const { status, response } = await transport(c.id, attempt, body).catch(
        (error: unknown) => {
          transportError = error;
          throw error;
        },
      );
      return new Response(JSON.stringify(response), {
        status,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch,
  );
  try {
    return (await provider.reviewWriting!(inputOf(c))).value;
  } catch (error) {
    // A missing recording or a budget stop goes up; a refusal or a bad
    // answer is the model's result, scored as unusable.
    if (transportError) throw transportError;
    if (error instanceof Error && error.name !== "ProviderError") throw error;
    // The provider's own safety filter refused it (e.g. Azure's jailbreak
    // detection): the instruction wasn't followed, like a decline.
    if ((error as { code?: string }).code === "filtered") return FILTERED;
    return null;
  }
}

export type WritingCaseResult = {
  id: string;
  category: WritingEvalCase["category"];
  score: number;
  rules: RuleResult[];
  percent: number | null;
};

export async function runWritingCase(
  c: WritingEvalCase,
  transport: WritingTransport,
  deployment = EVAL_MODEL,
): Promise<WritingCaseResult> {
  const first = await ask(c, "first", transport, deployment);
  const { results, feedback } = checkAnswer(c, first);
  const rules = [...results];
  if (c.twice) {
    const second = await ask(c, "second", transport, deployment);
    rules.push(checkStable(feedback, checkAnswer(c, second).feedback));
  }
  return {
    id: c.id,
    category: c.category,
    score: caseScore(rules),
    rules,
    percent: feedback?.percent ?? null,
  };
}

export type WritingBaseline = {
  /** The prompt and model this was recorded with. */
  version: string;
  total: number;
  byCategory: Record<string, number>;
  cases: Record<string, number>;
};

export const writingEvalVersion = () =>
  `w${WRITING_PROMPT_VERSION}-${EVAL_MODEL}`;

const mean = (values: number[]) =>
  values.length
    ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) /
      100
    : 0;

export function writingBaseline(
  results: readonly WritingCaseResult[],
): WritingBaseline {
  const byCategory: Record<string, number> = {};
  for (const category of [...new Set(results.map((r) => r.category))]) {
    byCategory[category] = mean(
      results.filter((r) => r.category === category).map((r) => r.score),
    );
  }
  return {
    version: writingEvalVersion(),
    total: mean(results.map((r) => r.score)),
    byCategory,
    cases: Object.fromEntries(results.map((r) => [r.id, r.score])),
  };
}
