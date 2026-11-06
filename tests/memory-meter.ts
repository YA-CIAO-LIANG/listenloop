import { vi } from "vitest";
import type { Billed } from "@/lib/ai/types";
import type { UsageKind, UsageLogEntry, UsageMeter } from "@/lib/usage";

/**
 * A usage meter with a running total per kind, like the database
 * functions: reserve within `limits`, settle never below zero, and a log.
 */
export function memoryMeter(limits: Partial<Record<UsageKind, number>> = {}) {
  const used = new Map<UsageKind, number>();
  const logs: UsageLogEntry[] = [];
  const meter = {
    used,
    logs,
    reserve: vi.fn(async (kind: UsageKind, amount: number) => {
      const total = (used.get(kind) ?? 0) + amount;
      if (total > (limits[kind] ?? Infinity)) return false;
      used.set(kind, total);
      return true;
    }),
    settle: vi.fn(async (micros: number) => {
      used.set("cost", Math.max(0, (used.get("cost") ?? 0) + micros));
    }),
    log: vi.fn(async (entry: UsageLogEntry) => {
      logs.push(entry);
    }),
  } satisfies UsageMeter & Record<string, unknown>;
  return meter;
}

/** A provider answer that cost nothing, for stubbed provider methods. */
export function billed<T>(value: T, chars = 0): Billed<T> {
  return {
    value,
    usage: { inputTokens: 0, outputTokens: 0, chars, costUsd: 0 },
  };
}

/**
 * A price that makes the worst case of a language call easy to predict:
 * one micro-dollar per input character, instructions included
 * (lib/ai/budgets.ts), and nothing for output.
 */
export const TEST_PRICE = { inputPerM: 1, outputPerM: 0 } as const;
