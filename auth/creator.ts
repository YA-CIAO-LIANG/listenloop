import {
  diagnoseAiProviders,
  getAiProviders,
  type ConfigCheck,
} from "@/lib/ai/providers";
import type { MeteredDeps } from "@/lib/ai/metered";
import { supabaseConfig } from "@/lib/supabase/config";
import { DAILY_LIMITS, usageDay, type UsageMeter } from "@/lib/usage";
import type { Supabase } from "@/lib/supabase/browser";
import type { AudioStore } from "@/lib/custom-practice/audio";
import type { AiCache } from "@/lib/custom-practice/notes";
import { getAdminSupabase, hasAdminSupabase } from "./admin";
import { supabaseAiCache } from "./ai-cache";
import { supabaseAudioStore } from "./audio-store";
import { getSignedInUser, type SignedInUser } from "./session";

/**
 * Usage recorded with the secret-key client (users can't write it):
 * speech characters in api_usage (reserve_api_usage), language-model
 * cost in api_daily_cost (reserve_api_cost, settle_api_cost), and every
 * call in api_calls (D38). The day is fixed when the meter is made, so a
 * call that runs past midnight settles on the day it reserved.
 */
export function supabaseUsageMeter(
  admin: Supabase,
  userId: string,
  now: () => Date = () => new Date(),
): UsageMeter {
  const day = usageDay(now());
  return {
    async reserve(kind, amount) {
      const { data, error } =
        kind === "speech"
          ? await admin.rpc("reserve_api_usage", {
              target_user: userId,
              usage_kind: kind,
              usage_day: day,
              amount,
              max_chars: DAILY_LIMITS.speech,
            })
          : await admin.rpc("reserve_api_cost", {
              target_user: userId,
              usage_day: day,
              amount,
              max_micros: DAILY_LIMITS.cost,
            });
      if (error) throw new Error(error.message);
      return data === true;
    },
    async settle(micros) {
      const { error } = await admin.rpc("settle_api_cost", {
        target_user: userId,
        usage_day: day,
        delta: micros,
      });
      if (error) throw new Error(error.message);
    },
    async log(entry) {
      const { error } = await admin.from("api_calls").insert({
        user_id: userId,
        provider: entry.provider,
        operation: entry.operation,
        error: entry.error,
        http_status: entry.httpStatus,
        error_code: entry.errorCode,
        input_tokens: entry.inputTokens,
        output_tokens: entry.outputTokens,
        chars: entry.chars,
        cost_micros: entry.costMicros,
      });
      if (error) throw new Error(error.message);
    },
  };
}

export type Creator = MeteredDeps & {
  user: SignedInUser;
  store: AudioStore;
  cache: AiCache;
};

/**
 * Whether to show "Create a practice" to this user: an admin, with the
 * providers and the secret key configured; the same conditions as
 * getCreator, without making the clients.
 */
export function canCreatePractices(
  user: SignedInUser | null,
): user is SignedInUser {
  return (
    !!user &&
    user.role === "admin" &&
    hasAdminSupabase() &&
    getAiProviders() !== null
  );
}

/**
 * Every condition canCreatePractices and getCreator check, grouped for the
 * setup check on /admin/usage (D47): whether each holds, never a value.
 */
export function diagnoseCreator(user: SignedInUser | null) {
  const ai = diagnoseAiProviders();
  const account: ConfigCheck[] = [
    { id: "admin", ok: user?.role === "admin" },
    { id: "supabase", ok: supabaseConfig !== null },
    { id: "serviceKey", ok: hasAdminSupabase() },
    { id: "notFake", ok: ai.fake !== "blocked" },
  ];
  // With the fakes on (local, preview), the vendors' keys don't matter.
  const withChoice = (
    id: string,
    setup: typeof ai.language | typeof ai.speech,
  ) =>
    ai.fake === "on"
      ? { vendor: "fake" as const, checks: [{ id: "fakeInUse", ok: true }] }
      : {
          vendor: setup.vendor,
          checks: [{ id, ok: setup.vendor !== null }, ...setup.checks],
        };
  return {
    ready: canCreatePractices(user),
    groups: [
      { id: "account" as const, vendor: null, checks: account },
      { id: "language" as const, ...withChoice("languageChoice", ai.language) },
      { id: "speech" as const, ...withChoice("speechChoice", ai.speech) },
    ],
  };
}

/**
 * The signed-in admin, for actions that don't call a paid API (organizing
 * practices, notebooks). Null for everyone else.
 */
export async function getAdminUser(): Promise<SignedInUser | null> {
  const user = await getSignedInUser();
  return user?.role === "admin" ? user : null;
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
    cache: supabaseAiCache(admin),
  };
}
