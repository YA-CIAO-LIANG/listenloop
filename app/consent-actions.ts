"use server";

import { getServerSupabase } from "@/auth/server";
import { getSignedInUser } from "@/auth/session";
import { CONSENT_DOCUMENT, parseConsent } from "@/lib/analytics-consent";
import { NOTICES_DOCUMENT } from "@/lib/notices";

/**
 * Keeps the signed-in person's analytics cookie choice in their account
 * (D180), so they aren't asked again on another device. Signed out, the
 * browser's cookie is all there is.
 */
export async function saveConsent(value: string): Promise<{ ok: boolean }> {
  const consent = parseConsent(value);
  const user = await getSignedInUser();
  const supabase = user ? await getServerSupabase() : null;
  if (!consent || !user || !supabase) return { ok: false };
  const { error } = await supabase.from("user_documents").upsert({
    user_id: user.id,
    key: CONSENT_DOCUMENT,
    data: { consent, at: new Date().toISOString() },
  });
  return { ok: !error };
}

/**
 * Keeps in the signed-in person's account that they dismissed the usage
 * notice (D180), so another device doesn't show it again.
 */
export async function dismissUsageNotice(): Promise<{ ok: boolean }> {
  const user = await getSignedInUser();
  const supabase = user ? await getServerSupabase() : null;
  if (!user || !supabase) return { ok: false };
  const { error } = await supabase.from("user_documents").upsert({
    user_id: user.id,
    key: NOTICES_DOCUMENT,
    data: { usage: new Date().toISOString() },
  });
  return { ok: !error };
}
