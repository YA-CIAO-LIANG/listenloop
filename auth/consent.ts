import { getServerSupabase } from "@/auth/server";
import { getSignedInUser } from "@/auth/session";
import { NOTICES_DOCUMENT, usageNoticeDismissed } from "@/lib/notices";
import {
  CONSENT_DOCUMENT,
  parseConsentDocument,
  type Consent,
} from "@/lib/analytics-consent";

/**
 * The signed-in person's analytics cookie choice (D180): undefined when
 * signed out (the browser keeps it), null when they haven't chosen.
 */
export async function getAccountConsent(): Promise<Consent | null | undefined> {
  const user = await getSignedInUser();
  const supabase = user ? await getServerSupabase() : null;
  if (!user || !supabase) return undefined;
  const { data } = await supabase
    .from("user_documents")
    .select("data")
    .eq("user_id", user.id)
    .eq("key", CONSENT_DOCUMENT)
    .maybeSingle();
  return parseConsentDocument(data?.data ?? null);
}

/**
 * Whether the signed-in person dismissed the usage notice on any device
 * (D180); false when signed out or not dismissed.
 */
export async function getUsageNoticeDismissed(): Promise<boolean> {
  const user = await getSignedInUser();
  const supabase = user ? await getServerSupabase() : null;
  if (!user || !supabase) return false;
  const { data } = await supabase
    .from("user_documents")
    .select("data")
    .eq("user_id", user.id)
    .eq("key", NOTICES_DOCUMENT)
    .maybeSingle();
  return usageNoticeDismissed(data?.data ?? null);
}
