/**
 * Tests never reach the paid APIs (CLAUDE.md, "AI 供應者與測試"): a
 * request to one fails at once, even if a test forgets to pass its own
 * fetch or real keys are in the environment. Provider tests pass a stub
 * fetchImpl or replay recorded fixtures (tests/fixtures/ai/).
 */
const PAID_HOSTS = [
  /\.openai\.azure\.com$/,
  /\.cognitiveservices\.azure\.com$/,
  /\.speech\.microsoft\.com$/,
  /(^|\.)googleapis\.com$/,
];

export function isPaidApiUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return PAID_HOSTS.some((host) => host.test(hostname));
  } catch {
    return false;
  }
}

const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  if (isPaidApiUrl(url)) {
    throw new Error(`Tests must not call paid APIs: ${url}`);
  }
  return realFetch(input, init);
}) as typeof fetch;
