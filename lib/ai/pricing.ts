/**
 * List prices of the paid APIs, used to estimate what each call costs
 * (D38): the daily limit, the usage log, and /admin/usage all use these.
 * Estimates only; the provider's bill is the real figure. Change a price
 * here when the provider changes it.
 */
export type TokenPrice = {
  /** US$ per million input tokens. */
  inputPerM: number;
  /** US$ per million output tokens, thinking or reasoning included. */
  outputPerM: number;
};

/**
 * By provider and model, as in the provider id ("azure-openai/gpt-5-mini").
 * Checked 2026-11-05: Azure from the retail prices API
 * (prices.azure.com, Global Standard in uaenorth); Gemini from
 * aistudio.google.com/docs/pricing (Standard tier, through 2026-12-31;
 * from 2027-01-01 it doubles to 1.50 / 7.50).
 */
export const LANGUAGE_PRICES: Readonly<Record<string, TokenPrice>> = {
  "azure-openai/gpt-5-mini": { inputPerM: 0.25, outputPerM: 2.0 },
  "azure-openai/gpt-4.1-mini": { inputPerM: 0.4, outputPerM: 1.6 },
  "gemini/gemini-3.6-flash": { inputPerM: 0.75, outputPerM: 3.75 },
};

/**
 * US$ per million characters of speech. Azure Speech is on the free F0
 * tier (500,000 characters a month, then it stops instead of charging);
 * Chirp 3 HD is free for the first million a month, then 30 (D29), and
 * is logged at that price so the estimate errs high.
 */
export const SPEECH_PRICES_PER_M_CHARS = {
  azureF0: 0,
  googleChirp3Hd: 30,
} as const;

/**
 * Costs are counted in whole micro-dollars (US$0.000001), rounded up so
 * the estimate errs high (the tolerance absorbs floating-point noise).
 */
export function toMicros(usd: number): number {
  const micros = Math.ceil(usd * 1_000_000 - 1e-9);
  return micros > 0 ? micros : 0;
}

export function tokenCost(
  price: TokenPrice,
  inputTokens: number,
  outputTokens: number,
): number {
  return (
    (inputTokens * price.inputPerM + outputTokens * price.outputPerM) /
    1_000_000
  );
}
