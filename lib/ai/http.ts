import { ProviderError } from "./types";

/** Requests to the AI providers give up after this long. */
export const PROVIDER_TIMEOUT_MS = 60_000;

/**
 * POSTs JSON to a Google API with the key in a header (not the URL, so it
 * never lands in logs) and maps failures to ProviderError codes: busy
 * (429, 503: try again later), config (400–404: bad key, API not enabled,
 * unknown model), failed (anything else).
 */
export async function postGoogleJson(
  url: string,
  apiKey: string,
  body: unknown,
  fetchImpl: typeof fetch,
  service: string,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
  } catch (error) {
    throw new ProviderError(
      "failed",
      `${service}: request failed (${error instanceof Error ? error.message : String(error)})`,
    );
  }
  if (response.ok) return response.json();

  const detail = await response
    .json()
    .then((data: { error?: { message?: string } }) => data.error?.message ?? "")
    .catch(() => "");
  const message = `${service}: HTTP ${response.status} ${detail}`.trim();
  if (response.status === 429 || response.status === 503) {
    throw new ProviderError("busy", message);
  }
  if (response.status >= 400 && response.status <= 404) {
    throw new ProviderError("config", message);
  }
  throw new ProviderError("failed", message);
}
