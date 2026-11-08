import { toMicros } from "@/lib/ai/pricing";
import {
  BATCH_SPEECH_CHARS,
  type UsageLogEntry,
  type UsageMeter,
  type UsageSettings,
} from "@/lib/usage";

/**
 * The budget guard for scripts that call the paid APIs (D59, D69): every
 * language call reserves its worst case first, and a reservation that
 * could take the run past its budget (spent plus every open worst case)
 * is refused, which stops the call before it's made. Calls are counted
 * per item and for the whole run, for the report.
 */
export type Tally = {
  inputTokens: number;
  outputTokens: number;
  chars: number;
  micros: number;
  calls: number;
};

export const emptyTally = (): Tally => ({
  inputTokens: 0,
  outputTokens: 0,
  chars: 0,
  micros: 0,
  calls: 0,
});

export const usd = (micros: number) => `US$${(micros / 1_000_000).toFixed(4)}`;

export function guardedMeter(
  inner: UsageMeter,
  tally: { current: Tally; total: Tally },
  budgetUsd: number,
): UsageMeter {
  let reservedOpen = 0;
  const budget = toMicros(budgetUsd);
  return {
    async reserve(kind, amount) {
      if (
        kind === "cost" &&
        tally.total.micros + reservedOpen + amount > budget
      ) {
        console.log(
          `  ✋ budget: ${usd(tally.total.micros)} spent; this call could cost ${usd(amount)}`,
        );
        return false;
      }
      const ok = await inner.reserve(kind, amount);
      if (ok && kind === "cost") reservedOpen += amount;
      return ok;
    },
    async settle(micros) {
      await inner.settle(micros);
    },
    async log(entry: UsageLogEntry) {
      await inner.log(entry);
      if (entry.operation !== "speech") reservedOpen = 0;
      for (const t of [tally.current, tally.total]) {
        t.inputTokens += entry.inputTokens;
        t.outputTokens += entry.outputTokens;
        t.chars += entry.chars;
        t.micros += entry.costMicros;
        t.calls += 1;
      }
    },
  };
}

/**
 * Batch scripts' meter settings (D77): the admin's batch allowance from
 * usage_settings, apart from what's created by hand, and more speech.
 */
export function batchMeterOptions(settings: UsageSettings) {
  return {
    limits: { speech: BATCH_SPEECH_CHARS, cost: settings.adminBatchMicros },
    bucket: "batch" as const,
    monthlyMicros: null,
  };
}
