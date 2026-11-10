import {
  countChars,
  type UsageBlock,
  type UsageKind,
  type UsageMeter,
} from "@/lib/usage";
import { maxCost, type LanguageBudget } from "./budgets";
import { toMicros } from "./pricing";
import {
  ProviderError,
  type AiProviders,
  type Billed,
  type CallUsage,
  type ProviderErrorDetail,
  type SpeechAudio,
  type Voice,
} from "./types";

/**
 * The paid calls, each behind a daily limit (D7, D38): the worst case is
 * reserved first and the provider is called only if that succeeds. Once
 * the call is done, the reservation is settled to what it really cost.
 * A failed call that reports no usage keeps its reservation, so a failing
 * provider can't be retried past the limit. Every call is logged.
 */
export type MeteredResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      reason: MeteredFailure;
      /** For "limit": which allowance ran out, and when it resets (D77). */
      limit?: UsageBlock;
      /**
       * With "failed": a safety filter or the model refused the content,
       * so asking differently may work (D123).
       */
      filtered?: true;
    };

/**
 * limit: today's allowance is used up; busy: the provider is rate-limited;
 * config: a bad key or an API that isn't enabled (only admins create
 * practices, so they're told which).
 */
export type MeteredFailure = "limit" | "busy" | "config" | "failed";

export type MeteredDeps = { providers: AiProviders; meter: UsageMeter };

type Charge = {
  kind: UsageKind;
  provider: string;
  operation: string;
  /** Characters sent, logged even when the provider reports no usage. */
  chars: number;
  /** Micro-dollars reserved against the cost limit (kind "cost" only). */
  reservedMicros: number;
};

/**
 * Settling and logging never fail the call: the work is done (and paid
 * for) by then. Problems go to the server log.
 */
async function bookkeep(run: () => Promise<void>) {
  try {
    await run();
  } catch (error) {
    console.error(
      `[AI] usage bookkeeping failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function finish(
  meter: UsageMeter,
  charge: Charge,
  usage: CallUsage | undefined,
  error: MeteredFailure | "filtered" | null,
  detail: ProviderErrorDetail = {},
  outcome: string | null = null,
) {
  // Without a usage report, a language call keeps its whole reservation.
  const spent = usage
    ? toMicros(usage.costUsd)
    : charge.kind === "cost"
      ? charge.reservedMicros
      : 0;
  if (charge.kind === "cost" && spent !== charge.reservedMicros) {
    await bookkeep(() => meter.settle(spent - charge.reservedMicros));
  }
  await bookkeep(() =>
    meter.log({
      provider: charge.provider,
      operation: charge.operation,
      error,
      httpStatus: detail.status ?? null,
      errorCode: detail.code ?? null,
      outcome,
      inputTokens: usage?.inputTokens ?? 0,
      outputTokens: usage?.outputTokens ?? 0,
      chars: usage?.chars || charge.chars,
      costMicros: spent,
    }),
  );
}

/** Reserves first; a meter that can't be reached counts as a failure. */
async function metered<T>(
  meter: UsageMeter,
  reserve: () => Promise<boolean>,
  charge: Charge,
  call: () => Promise<Billed<T>>,
  describe?: (value: T) => string,
): Promise<MeteredResult<T>> {
  try {
    if (!(await reserve())) {
      const limit = meter.lastBlock?.() ?? undefined;
      return limit
        ? { ok: false, reason: "limit", limit }
        : { ok: false, reason: "limit" };
    }
  } catch {
    return { ok: false, reason: "failed" };
  }
  try {
    const { value, usage } = await call();
    // A provider that answered did so with HTTP 200 (D123); the fakes
    // make no request.
    await finish(
      meter,
      charge,
      usage,
      null,
      charge.provider.startsWith("fake") ? {} : { status: 200 },
      describe ? outcomeCode(describe, value) : null,
    );
    return { ok: true, value };
  } catch (error) {
    const code = error instanceof ProviderError ? error.code : "failed";
    // The details (status, the provider's message) go to the server log only.
    if (error instanceof ProviderError) console.error(`[AI] ${error.message}`);
    await finish(
      meter,
      charge,
      error instanceof ProviderError ? error.usage : undefined,
      code,
      error instanceof ProviderError ? error.detail : { code: "exception" },
    );
    return code === "filtered"
      ? { ok: false, reason: "failed", filtered: true }
      : { ok: false, reason: code };
  }
}

/** What a call's answer amounted to, as logged: short, never throws. */
function outcomeCode<T>(describe: (value: T) => string, value: T): string {
  try {
    return describe(value).slice(0, 40);
  } catch {
    return "unreadable";
  }
}

/**
 * Any metered language-model call, e.g. notes (lib/custom-practice/notes.ts).
 * `budget` is the call's size (lib/ai/budgets.ts), so the worst case is
 * what gets reserved.
 */
export function meteredLanguage<T>(
  { providers, meter }: MeteredDeps,
  budget: LanguageBudget,
  call: () => Promise<Billed<T>>,
  /** What the answer amounted to, for the usage log ("changed 5/7"). */
  describe?: (value: T) => string,
): Promise<MeteredResult<T>> {
  const reservedMicros = toMicros(maxCost(budget, providers.language.price));
  return metered(
    meter,
    () => meter.reserve("cost", reservedMicros),
    {
      kind: "cost",
      provider: providers.language.id,
      operation: budget.operation,
      chars: budget.inputChars,
      reservedMicros,
    },
    call,
    describe,
  );
}

export async function meteredSpeech(
  { providers, meter }: MeteredDeps,
  text: string,
  voice: Voice,
): Promise<MeteredResult<SpeechAudio>> {
  const chars = countChars([text]);
  return metered(
    meter,
    () => meter.reserve("speech", chars),
    {
      kind: "speech",
      provider: providers.speech.id,
      operation: "speech",
      chars,
      reservedMicros: 0,
    },
    () => providers.speech.synthesize(text, voice),
  );
}
