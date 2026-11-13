import { featurePaused } from "./site-switches";
import {
  diagnoseAiProviders,
  getAiProviders,
  type ConfigCheck,
} from "@/lib/ai/providers";
import type { MeteredDeps } from "@/lib/ai/metered";
import { TRANSCRIBE_MONTHLY_SECONDS } from "@/lib/ai/pricing";
import { YOUTUBE_LINK_PRACTICES_ENABLED } from "@/lib/features";
import { can, planFor } from "@/lib/plans";
import { supabaseConfig } from "@/lib/supabase/config";
import {
  DAILY_LIMITS,
  dailyCostLimit,
  nextUsageDay,
  usageDay,
  usageMonth,
  type UsageBlock,
  type UsageBucket,
  type UsageKind,
  type UsageMeter,
} from "@/lib/usage";
import { getUsageSettings } from "./usage-settings";
import type { Supabase } from "@/lib/supabase/browser";
import type { AudioStore } from "@/lib/custom-practice/audio";
import type { AiCache } from "@/lib/custom-practice/notes";
import { getAdminSupabase, hasAdminSupabase } from "./admin";
import { supabaseAiCache } from "./ai-cache";
import { supabaseAudioStore } from "./audio-store";
import { getSignedInUser, type SignedInUser } from "./session";
import { youtubeEnabled } from "./youtube";

/**
 * Usage recorded with the secret-key client (users can't write it):
 * speech characters in api_usage (reserve_api_usage), language-model
 * cost in api_daily_cost, or api_batch_cost for batch jobs (D77), and
 * every call in api_calls (D38). Before a cost is reserved, the month's
 * site-wide total is checked against `monthlyMicros` (null: no cap, for
 * admins). The day is fixed when the meter is made, so a call that runs
 * past midnight settles on the day it reserved.
 */
export function supabaseUsageMeter(
  admin: Supabase,
  userId: string,
  now: () => Date = () => new Date(),
  {
    limits = DAILY_LIMITS,
    bucket = "manual",
    monthlyMicros = null,
  }: {
    limits?: Readonly<Record<UsageKind, number>>;
    bucket?: UsageBucket;
    monthlyMicros?: number | null;
  } = {},
): UsageMeter {
  const started = now();
  const day = usageDay(started);
  let block: UsageBlock | null = null;
  const blocked = (kind: UsageBlock["kind"], resetsAt: Date) => {
    block = { kind, resetsAt: resetsAt.toISOString() };
    return false;
  };
  return {
    async reserve(kind, amount) {
      block = null;
      if (kind === "speech") {
        const { data, error } = await admin.rpc("reserve_api_usage", {
          target_user: userId,
          usage_kind: kind,
          usage_day: day,
          amount,
          max_chars: limits.speech,
        });
        if (error) throw new Error(error.message);
        return data === true || blocked("speech", nextUsageDay(started));
      }
      if (monthlyMicros !== null) {
        const month = usageMonth(started);
        const { data: spent, error } = await admin.rpc("month_api_cost", {
          month_start: month.start.toISOString(),
        });
        if (error) throw new Error(error.message);
        if ((spent ?? 0) + amount > monthlyMicros) {
          return blocked("monthly", month.next);
        }
      }
      const args = {
        target_user: userId,
        usage_day: day,
        amount,
        max_micros: limits.cost,
      };
      const { data, error } =
        bucket === "batch"
          ? await admin.rpc("reserve_api_batch_cost", args)
          : await admin.rpc("reserve_api_cost", args);
      if (error) throw new Error(error.message);
      return (
        data === true ||
        blocked(bucket === "batch" ? "batch" : "daily", nextUsageDay(started))
      );
    },
    async settle(micros) {
      const args = { target_user: userId, usage_day: day, delta: micros };
      const { error } =
        bucket === "batch"
          ? await admin.rpc("settle_api_batch_cost", args)
          : await admin.rpc("settle_api_cost", args);
      if (error) throw new Error(error.message);
    },
    lastBlock: () => block,
    async allowAudio(ms, userMaxMs) {
      const month = usageMonth(started);
      const { data, error } = await admin.rpc("month_audio_ms", {
        month_start: month.start.toISOString(),
        target_user: userId,
      });
      if (error) throw new Error(error.message);
      const used = data?.[0] ?? { site: 0, mine: 0 };
      if (used.site + ms > TRANSCRIBE_MONTHLY_SECONDS * 1000) {
        return blocked("monthly", month.next);
      }
      if (userMaxMs !== null && used.mine + ms > userMaxMs) {
        return blocked("monthly", month.next);
      }
      return true;
    },
    async log(entry) {
      const { error } = await admin.from("api_calls").insert({
        user_id: userId,
        provider: entry.provider,
        operation: entry.operation,
        error: entry.error,
        http_status: entry.httpStatus,
        error_code: entry.errorCode,
        outcome: entry.outcome ?? null,
        input_tokens: entry.inputTokens,
        output_tokens: entry.outputTokens,
        chars: entry.chars,
        cost_micros: entry.costMicros,
        audio_ms: entry.audioMs ?? 0,
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
 * Whether to show "Create a practice" to this user: a plan that creates
 * practices (every signed-in plan since D72; how many is checked when
 * one is created), with the providers and the secret key configured; the
 * same conditions as getCreator, without making the clients.
 */
export function canCreatePractices(
  user: SignedInUser | null,
): user is SignedInUser {
  return (
    !!user &&
    can(planFor(user), { kind: "create-practice" }).ok &&
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
      // Optional (D130): uploaded recordings need speech to text, with
      // Azure Speech's key and region; it doesn't decide `ready`.
      {
        id: "transcribe" as const,
        ...(ai.fake === "on"
          ? { vendor: "fake" as const, checks: [{ id: "fakeInUse", ok: true }] }
          : { vendor: "azure" as const, checks: ai.transcribe.checks }),
      },
      // Optional (D129), and hidden while YouTube links are paused (D131).
      ...(YOUTUBE_LINK_PRACTICES_ENABLED
        ? [
            {
              id: "youtube" as const,
              vendor: null,
              checks: [{ id: "youtubeKey", ok: youtubeEnabled() }],
            },
          ]
        : []),
    ],
  };
}

/**
 * The signed-in admin, for actions that don't call a paid API (organizing
 * practices, the admin pages). Null for everyone else.
 */
export async function getAdminUser(): Promise<SignedInUser | null> {
  const user = await getSignedInUser();
  return user?.role === "admin" ? user : null;
}

/**
 * Who may create practices: signed-in accounts whose plan allows it (D72;
 * the free plan's one-practice trial and the paid plan's monthly count
 * are checked when a practice is created), and only when a provider and
 * the secret key are configured. Every server action of roadmap d starts
 * here; null means "not available".
 */
export async function getCreator(): Promise<Creator | null> {
  const providers = getAiProviders();
  if (!providers) return null;
  const user = await getSignedInUser();
  if (!canCreatePractices(user)) return null;
  // Maintenance or read-only (D155): nothing that calls a paid API.
  if (await featurePaused(user, "create")) return null;
  const admin = getAdminSupabase();
  if (!admin) return null;
  return {
    user,
    providers,
    meter: await creatorMeter(admin, user, "manual"),
    store: supabaseAudioStore(admin),
    cache: supabaseAiCache(admin),
  };
}

/**
 * The meter for `user` doing `bucket` work (D77): the plan's daily cost
 * limit from usage_settings, and the site's monthly cap for everyone
 * but admins.
 */
export async function creatorMeter(
  admin: Supabase,
  user: SignedInUser,
  bucket: UsageBucket,
): Promise<UsageMeter> {
  const settings = await getUsageSettings(admin);
  const plan = planFor(user);
  return supabaseUsageMeter(admin, user.id, () => new Date(), {
    limits: {
      speech: DAILY_LIMITS.speech,
      cost: dailyCostLimit(settings, plan, bucket),
    },
    bucket,
    monthlyMicros: plan === "admin" ? null : settings.siteMonthlyMicros,
  });
}

/**
 * The admin's batch jobs on the dashboard (D77, D80): like getCreator,
 * but on the batch allowance, so they never use up the manual one.
 */
export async function getBatchCreator(): Promise<Creator | null> {
  const providers = getAiProviders();
  if (!providers) return null;
  const user = await getAdminUser();
  const admin = getAdminSupabase();
  if (!user || !admin) return null;
  return {
    user,
    providers,
    meter: await creatorMeter(admin, user, "batch"),
    store: supabaseAudioStore(admin),
    cache: supabaseAiCache(admin),
  };
}
