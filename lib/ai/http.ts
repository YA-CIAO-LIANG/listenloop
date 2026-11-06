import { ProviderError } from "./types";

/** Requests to the AI providers give up after this long. */
export const PROVIDER_TIMEOUT_MS = 60_000;

/**
 * POSTs to a provider API, with the key in a header (never the URL, so it
 * doesn't land in logs), and maps failures to ProviderError codes:
 * - busy: 429, 503 (rate-limited, try again later);
 * - config: 400–404 (bad key, API not enabled, unknown model or
 *   deployment, 402 for used-up Gemini prepaid credits, 403 for a used-up
 *   Azure free tier or credit);
 * - failed: anything else, and content the provider refused to handle
 *   (Azure's content filter answers 400 with code "content_filter"),
 *   since that's the text, not the setup.
 * Returns the response when it's OK.
 */
export async function postToProvider(
  url: string,
  init: { headers: Record<string, string>; body: string },
  fetchImpl: typeof fetch,
  service: string,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: init.headers,
      body: init.body,
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
  } catch (error) {
    throw new ProviderError(
      "failed",
      `${service}: request failed (${error instanceof Error ? error.message : String(error)})`,
    );
  }
  if (response.ok) return response;

  const detail = await response
    .json()
    .then(
      (data: { error?: { message?: string; code?: string } }) =>
        data.error ?? {},
    )
    .catch(() => ({}) as { message?: string; code?: string });
  const message =
    `${service}: HTTP ${response.status} ${detail.code ?? ""} ${detail.message ?? ""}`
      .replace(/\s+/g, " ")
      .trim();
  if (response.status === 429 || response.status === 503) {
    throw new ProviderError("busy", message);
  }
  if (detail.code === "content_filter") {
    throw new ProviderError("failed", message);
  }
  if (response.status >= 400 && response.status <= 404) {
    throw new ProviderError("config", message);
  }
  throw new ProviderError("failed", message);
}

/** A Google API call with a JSON body and answer. */
export async function postGoogleJson(
  url: string,
  apiKey: string,
  body: unknown,
  fetchImpl: typeof fetch,
  service: string,
): Promise<unknown> {
  const response = await postToProvider(
    url,
    {
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
    },
    fetchImpl,
    service,
  );
  return response.json();
}
