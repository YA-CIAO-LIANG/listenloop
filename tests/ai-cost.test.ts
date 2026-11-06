import { describe, expect, it, vi } from "vitest";
import {
  annotateBudget,
  composeBudget,
  INSTRUCTION_CHARS,
  maxCost,
  segmentBudget,
  translateBudget,
} from "@/lib/ai/budgets";
import { fakeLanguage, fakeSpeech } from "@/lib/ai/fake";
import { meteredLanguage, meteredSpeech } from "@/lib/ai/metered";
import { LANGUAGE_PRICES, tokenCost, toMicros } from "@/lib/ai/pricing";
import { ProviderError, type AiProviders } from "@/lib/ai/types";
import { billed, memoryMeter } from "./memory-meter";

const price = LANGUAGE_PRICES["azure-openai/gpt-5-mini"];
const providers: AiProviders = {
  language: { ...fakeLanguage, id: "test/model", price },
  speech: fakeSpeech,
};
const budget = translateBudget(["Hello there."]);
const worst = toMicros(maxCost(budget, price));
const usage = (inputTokens: number, outputTokens: number) => ({
  inputTokens,
  outputTokens,
  chars: 12,
  costUsd: tokenCost(price, inputTokens, outputTokens),
});

describe("pricing", () => {
  it("rounds costs up to whole micro-dollars, never below zero", () => {
    expect(toMicros(0)).toBe(0);
    expect(Object.is(toMicros(0), 0)).toBe(true);
    expect(toMicros(0.000_000_1)).toBe(1);
    expect(toMicros(0.000_003)).toBe(3);
    expect(toMicros(-1)).toBe(0);
  });

  it("prices gpt-5-mini at US$0.25 in and 2.00 out per million tokens", () => {
    expect(tokenCost(price, 1_000_000, 0)).toBeCloseTo(0.25);
    expect(tokenCost(price, 0, 1_000_000)).toBeCloseTo(2);
  });
});

describe("budgets", () => {
  it("caps output by the size of each job", () => {
    expect(translateBudget(["你好"]).maxOutputTokens).toBe(203);
    expect(translateBudget(["x".repeat(20_000)]).maxOutputTokens).toBe(8_000);
    expect(annotateBudget(["a", "b"]).maxOutputTokens).toBe(700);
    expect(annotateBudget(Array(100).fill("a")).maxOutputTokens).toBe(6_000);
    expect(segmentBudget(["Hi. Bye."]).maxOutputTokens).toBe(208);
    expect(
      composeBudget({
        topic: "",
        scenario: "s",
        level: "l",
        words: 390,
        format: "dialogue",
      }).maxOutputTokens,
    ).toBe(1_080);
  });

  it("errs high: every input character counts as a token", () => {
    expect(maxCost(budget, price)).toBeCloseTo(
      ((12 + INSTRUCTION_CHARS) * 0.25 + budget.maxOutputTokens * 2) / 1e6,
    );
  });
});

describe("meteredLanguage", () => {
  it("reserves the worst case, then settles to the real cost and logs it", async () => {
    const meter = memoryMeter({ cost: 1_000_000 });
    const result = await meteredLanguage(
      { providers, meter },
      budget,
      async () => ({
        value: "ok",
        usage: usage(400, 100),
      }),
    );
    expect(result).toEqual({ ok: true, value: "ok" });
    expect(meter.reserve).toHaveBeenCalledWith("cost", worst);
    const real = toMicros(tokenCost(price, 400, 100));
    expect(meter.settle).toHaveBeenCalledWith(real - worst);
    expect(meter.used.get("cost")).toBe(real);
    expect(meter.logs).toEqual([
      {
        provider: "test/model",
        operation: "translate",
        error: null,
        inputTokens: 400,
        outputTokens: 100,
        chars: 12,
        costMicros: real,
      },
    ]);
  });

  it("stops before the call when the worst case would pass the limit", async () => {
    const meter = memoryMeter({ cost: worst - 1 });
    const call = vi.fn();
    expect(await meteredLanguage({ providers, meter }, budget, call)).toEqual({
      ok: false,
      reason: "limit",
    });
    expect(call).not.toHaveBeenCalled();
    expect(meter.logs).toEqual([]);
  });

  it("keeps the whole reservation when a failed call reports no usage", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const meter = memoryMeter();
    const result = await meteredLanguage({ providers, meter }, budget, () =>
      Promise.reject(new ProviderError("busy", "429")),
    );
    expect(result).toEqual({ ok: false, reason: "busy" });
    expect(meter.settle).not.toHaveBeenCalled();
    expect(meter.used.get("cost")).toBe(worst);
    expect(meter.logs[0]).toMatchObject({ error: "busy", costMicros: worst });
  });

  it("charges what a failed call still cost when it says", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const meter = memoryMeter();
    await meteredLanguage({ providers, meter }, budget, () =>
      Promise.reject(new ProviderError("failed", "cut off", usage(400, 200))),
    );
    const real = toMicros(tokenCost(price, 400, 200));
    expect(meter.used.get("cost")).toBe(real);
    expect(meter.logs[0]).toMatchObject({ error: "failed", costMicros: real });
  });

  it("still returns the answer when bookkeeping fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const meter = memoryMeter();
    meter.settle.mockRejectedValue(new Error("db down"));
    meter.log.mockRejectedValue(new Error("db down"));
    expect(
      await meteredLanguage({ providers, meter }, budget, async () =>
        billed("ok"),
      ),
    ).toEqual({ ok: true, value: "ok" });
  });
});

describe("meteredSpeech", () => {
  it("counts characters, not cost, and logs the call", async () => {
    const meter = memoryMeter({ speech: 100 });
    const result = await meteredSpeech({ providers, meter }, "Hello.", {
      accent: "us",
      gender: "female",
    });
    expect(result.ok).toBe(true);
    expect(meter.reserve).toHaveBeenCalledWith("speech", 6);
    expect(meter.settle).not.toHaveBeenCalled();
    expect(meter.logs).toEqual([
      {
        provider: "fake",
        operation: "speech",
        error: null,
        inputTokens: 0,
        outputTokens: 0,
        chars: 6,
        costMicros: 0,
      },
    ]);
  });
});

describe("the paid-API guard (tests/setup-network.ts)", () => {
  it.each([
    "https://listenloop-ai.openai.azure.com/openai/v1/chat/completions",
    "https://uaenorth.tts.speech.microsoft.com/cognitiveservices/v1",
    "https://generativelanguage.googleapis.com/v1beta/models/x",
    "https://texttospeech.googleapis.com/v1/text:synthesize",
  ])("blocks %s", async (url) => {
    await expect(fetch(url, { method: "POST" })).rejects.toThrow(
      "Tests must not call paid APIs",
    );
  });
});
