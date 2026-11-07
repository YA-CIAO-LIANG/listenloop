import {
  ProviderError,
  type ConnectionCheck,
  type ProviderErrorDetail,
} from "./types";

/**
 * Requests to the AI providers give up after this long: under the server
 * functions' maxDuration (60 s, D49), so a slow call is logged as a
 * timeout instead of the function being cut off with nothing recorded.
 */
export const PROVIDER_TIMEOUT_MS = 45_000;

/** A provider's error code as logged: short, plain characters only. */
export function errorCode(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const code = String(value)
    .replace(/[^\w.-]/g, "")
    .slice(0, 60);
  return code || undefined;
}

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
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    throw new ProviderError(
      "failed",
      `${service}: request failed (${error instanceof Error ? error.message : String(error)})`,
      undefined,
      { code: timedOut ? "timeout" : "network" },
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
  const logged: ProviderErrorDetail = {
    status: response.status,
    code: errorCode(detail.code),
  };
  const fail = (code: ProviderError["code"]) =>
    new ProviderError(code, message, undefined, logged);
  if (response.status === 429 || response.status === 503) throw fail("busy");
  if (detail.code === "content_filter") throw fail("failed");
  if (response.status >= 400 && response.status <= 404) throw fail("config");
  throw fail("failed");
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

/**
 * A free request that shows whether a provider accepts the key and
 * settings (D49): `works` decides from the status. Never throws; the
 * answer's status and short error code come back for the admin.
 */
export async function probeProvider(
  url: string,
  init: {
    method: "GET" | "POST";
    headers: Record<string, string>;
    body?: string;
  },
  fetchImpl: typeof fetch,
  works: (status: number) => boolean,
): Promise<ConnectionCheck> {
  try {
    const response = await fetchImpl(url, {
      ...init,
      signal: AbortSignal.timeout(15_000),
    });
    const ok = works(response.status);
    const code = ok
      ? undefined
      : await response
          .json()
          .then((data: { error?: { code?: unknown; status?: unknown } }) =>
            errorCode(data.error?.code ?? data.error?.status),
          )
          .catch(() => undefined);
    return { ok, status: response.status, ...(code ? { code } : {}) };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return { ok: false, code: timedOut ? "timeout" : "network" };
  }
}
