"use server";

import { revalidatePath } from "next/cache";
import { getAdminSupabase } from "@/auth/admin";
import { logAudit } from "@/auth/audit";
import { getAdminUser } from "@/auth/creator";
import { getUsageSettings } from "@/auth/usage-settings";
import { parseUsageSettings } from "@/lib/usage";
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

export type UsageSettingsResult =
  { ok: true } | { ok: false; reason: "unavailable" | "invalid" | "failed" };

/**
 * Saves the AI cost limits from /admin/usage (D77), typed in US$, and
 * records the change in the audit log. Admins only.
 */
export async function saveUsageSettings(
  input: unknown,
): Promise<UsageSettingsResult> {
  const [actor, admin] = [await getAdminUser(), getAdminSupabase()];
  if (!actor || !admin) return { ok: false, reason: "unavailable" };
  const settings = parseUsageSettings(input);
  if (!settings) return { ok: false, reason: "invalid" };
  const before = await getUsageSettings(admin);
  const { error } = await admin.from("usage_settings").upsert({
    id: 1,
    admin_manual_micros: settings.adminManualMicros,
    admin_batch_micros: settings.adminBatchMicros,
    paid_micros: settings.paidMicros,
    free_micros: settings.freeMicros,
    site_monthly_micros: settings.siteMonthlyMicros,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, reason: "failed" };
  await logAudit(
    actor.id,
    "usage.settings",
    { type: "setting", id: "usage" },
    { from: before, to: settings },
  );
  revalidatePath("/admin", "layout");
  return { ok: true };
}
