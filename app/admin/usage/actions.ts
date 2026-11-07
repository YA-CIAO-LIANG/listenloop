"use server";

import { getAdminUser } from "@/auth/creator";
import { getAiProviders } from "@/lib/ai/providers";
import type { ConnectionCheck } from "@/lib/ai/types";

export type ConnectionTestResult =
  | {
      ok: true;
      language: ConnectionCheck | null;
      speech: ConnectionCheck | null;
    }
  | { ok: false; reason: "unavailable" | "not-configured" };

/**
 * "Test connection" on /admin/usage (D49): each provider's free check, in
 * parallel. Nothing is billed or logged, so it doesn't count toward the
 * daily limits. Admins only. Null for a provider that has no check.
 */
export async function testConnections(): Promise<ConnectionTestResult> {
  if (!(await getAdminUser())) return { ok: false, reason: "unavailable" };
  const providers = getAiProviders();
  if (!providers) return { ok: false, reason: "not-configured" };
  const [language, speech] = await Promise.all([
    providers.language.checkConnection?.() ?? null,
    providers.speech.checkConnection?.() ?? null,
  ]);
  return { ok: true, language, speech };
}
