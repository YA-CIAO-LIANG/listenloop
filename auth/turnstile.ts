import { headers } from "next/headers";
import { TURNSTILE_VERIFY } from "@/lib/turnstile";

/**
 * Checks a Turnstile token with Cloudflare (D160). Without
 * TURNSTILE_SECRET_KEY it always passes (the check is off). A missing or
 * refused token fails. If Cloudflare can't be reached, it passes and
 * logs: a Cloudflare outage shouldn't close sign-ups, and the rate
 * limits still apply.
 */
export async function verifyTurnstile(
  token: unknown,
  {
    secret = process.env.TURNSTILE_SECRET_KEY,
    fetchImpl = fetch,
  }: { secret?: string; fetchImpl?: typeof fetch } = {},
): Promise<boolean> {
  const key = secret?.trim();
  if (!key) return true;
  if (typeof token !== "string" || token.length === 0 || token.length > 2048) {
    return false;
  }
  const body = new URLSearchParams({ secret: key, response: token });
  const ip = (await headers().catch(() => null))
    ?.get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  if (ip) body.set("remoteip", ip);
  try {
    const response = await fetchImpl(TURNSTILE_VERIFY, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = (await response.json()) as { success?: unknown };
    return data.success === true;
  } catch (error) {
    console.error(
      `[turnstile] not checked: ${error instanceof Error ? error.message : "unknown"}`,
    );
    return true;
  }
}
