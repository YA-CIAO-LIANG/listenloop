import { getAiProviders } from "@/lib/ai/providers";
import type { MeteredDeps } from "@/lib/ai/metered";
import { isAdminEmail } from "@/lib/admin";
import { DAILY_CHAR_LIMITS, usageDay, type UsageMeter } from "@/lib/usage";
import type { Supabase } from "@/lib/supabase/browser";
import type { AudioStore } from "@/lib/custom-practice/audio";
import { getAdminSupabase } from "./admin";
import { supabaseAudioStore } from "./audio-store";
import { getSignedInUser, type SignedInUser } from "./session";

/**
 * Usage recorded in api_usage through reserve_api_usage, which checks the
 * limit and adds in one statement. Needs the secret-key client: users
 * can read their usage but not write it.
 */
export function supabaseUsageMeter(
  admin: Supabase,
  userId: string,
  now: () => Date = () => new Date(),
): UsageMeter {
  return {
    async reserve(kind, chars) {
      const { data, error } = await admin.rpc("reserve_api_usage", {
        target_user: userId,
        usage_kind: kind,
        usage_day: usageDay(now()),
        amount: chars,
        max_chars: DAILY_CHAR_LIMITS[kind],
      });
      if (error) throw new Error(error.message);
      return data === true;
    },
  };
}

export type Creator = MeteredDeps & { user: SignedInUser; store: AudioStore };

/**
 * Whether to show "Create practice" to this user: an admin, with a
 * provider configured. A quick check for the header; getCreator is the
 * real gate.
 */
export function canCreatePractices(
  user: SignedInUser | null,
): user is SignedInUser {
  return !!user && isAdminEmail(user.email) && getAiProviders() !== null;
}

/**
 * Who may create practices: until paid plans launch, only signed-in admins
 * (D5), and only when a provider and the secret key are configured. Every
 * server action of roadmap d starts here; null means "not available".
 */
export async function getCreator(): Promise<Creator | null> {
  const providers = getAiProviders();
  if (!providers) return null;
  const user = await getSignedInUser();
  if (!canCreatePractices(user)) return null;
  const admin = getAdminSupabase();
  if (!admin) return null;
  return {
    user,
    providers,
    meter: supabaseUsageMeter(admin, user.id),
    store: supabaseAudioStore(admin),
  };
}
