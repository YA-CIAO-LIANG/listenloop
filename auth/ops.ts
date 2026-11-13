import { getAiProviders } from "@/lib/ai/providers";
import { TRANSCRIBE_MONTHLY_SECONDS } from "@/lib/ai/pricing";
import { SUPABASE_FREE } from "@/lib/admin-dashboard";
import {
  evaluateAlerts,
  healthStatus,
  newAlerts,
  type CheckResult,
  type HealthChecks,
  type OpsAlert,
  type OpsSnapshot,
} from "@/lib/ops/alerts";
import { alertLines, discordText, sendDiscord } from "@/lib/ops/notify";
import { supabaseConfig } from "@/lib/supabase/config";
import { usageDay, usageMonth } from "@/lib/usage";
import { AZURE_SPEECH_FREE_CHARS } from "@/lib/usage-report";
import { getAdminSupabase } from "./admin";
import { getUsageSettings } from "./usage-settings";

/**
 * Monitoring on the server (D156): health checks, the site's numbers,
 * and recording and sending alerts. Called by /api/health (quick checks)
 * and /api/cron/monitor (everything, every 15 minutes).
 */

type Admin = NonNullable<ReturnType<typeof getAdminSupabase>>;

const NO_USER = "00000000-0000-0000-0000-000000000000";

async function check(run: () => Promise<boolean>): Promise<CheckResult> {
  try {
    return (await run()) ? "ok" : "fail";
  } catch {
    return "fail";
  }
}

/**
 * The health checks. `deep` also asks the AI providers (their free
 * connection checks, D49); the public endpoint doesn't, so nobody can
 * make the site call Azure by loading a URL.
 */
export async function runHealthChecks(deep: boolean): Promise<HealthChecks> {
  const admin = getAdminSupabase();
  const providers = getAiProviders();
  const [db, storage, ai, speech] = await Promise.all([
    admin
      ? check(async () => {
          const { error } = await admin
            .from("site_settings")
            .select("id")
            .limit(1);
          return !error;
        })
      : Promise.resolve<CheckResult>("fail"),
    admin
      ? check(async () => !(await admin.storage.listBuckets()).error)
      : Promise.resolve<CheckResult>("fail"),
    deep && providers?.language.checkConnection
      ? check(async () => (await providers.language.checkConnection!()).ok)
      : Promise.resolve<CheckResult>(providers ? "skipped" : "fail"),
    deep && providers?.speech.checkConnection
      ? check(async () => (await providers.speech.checkConnection!()).ok)
      : Promise.resolve<CheckResult>(providers ? "skipped" : "fail"),
  ]);
  const config: CheckResult =
    supabaseConfig && admin && providers ? "ok" : "fail";
  return { db, storage, ai, speech, config };
}

/** The numbers behind the alerts, with the health checks. */
export async function collectSnapshot(
  admin: Admin,
  health: HealthChecks,
  now: Date,
): Promise<OpsSnapshot> {
  const dayStart = usageDay(now);
  const { start: monthStart } = usageMonth(now);
  const [snapshot, audio, settings] = await Promise.all([
    admin.rpc("ops_snapshot", {
      day_start: new Date(`${dayStart}T00:00:00+08:00`).toISOString(),
      month_start: monthStart.toISOString(),
    }),
    admin.rpc("month_audio_ms", {
      month_start: monthStart.toISOString(),
      target_user: NO_USER,
    }),
    getUsageSettings(admin),
  ]);
  const s = (snapshot.data ?? {}) as Record<string, unknown>;
  const n = (key: string) => Number(s[key] ?? 0) || 0;
  return {
    health,
    errors15m: n("errors_15m"),
    errors7d: n("errors_7d"),
    todayMicros: n("today_micros"),
    previousDaysMicros: Array.isArray(s.previous_days)
      ? s.previous_days.map((v) => Number(v) || 0)
      : [],
    monthMicros: n("month_micros"),
    monthCapMicros: settings.siteMonthlyMicros,
    speechCharsMonth: n("speech_chars_month"),
    speechCharsCap: AZURE_SPEECH_FREE_CHARS,
    audioSecondsMonth: Number(audio.data?.[0]?.site ?? 0) / 1000,
    audioSecondsCap: TRANSCRIBE_MONTHLY_SECONDS,
    databaseBytes: n("database_bytes"),
    databaseCap: SUPABASE_FREE.databaseBytes,
    storageBytes: n("storage_bytes"),
    storageCap: SUPABASE_FREE.storageBytes,
    signups1h: n("signups_1h"),
    reports1h: n("reports_1h"),
  };
}

/**
 * Keeps every alert, and sends the new ones (not sent in the last
 * hours) to Discord when it's set up. Returns the ones sent or due.
 */
export async function recordAlerts(
  admin: Admin,
  alerts: OpsAlert[],
  now: Date,
  send: (content: string) => Promise<boolean> = sendDiscord,
): Promise<{ fresh: OpsAlert[]; notified: boolean }> {
  if (alerts.length === 0) return { fresh: [], notified: false };
  const since = new Date(now.getTime() - 24 * 3_600_000).toISOString();
  const { data: recent } = await admin
    .from("ops_alerts")
    .select("key, created_at")
    .in(
      "key",
      alerts.map((a) => a.key),
    )
    .gte("created_at", since);
  const fresh = newAlerts(alerts, recent ?? [], now);
  if (fresh.length === 0) return { fresh, notified: false };
  const notified = await send(
    discordText("ListenLoop 監控通知", alertLines(fresh)),
  );
  await admin.from("ops_alerts").insert(
    fresh.map((alert) => ({
      key: alert.key,
      level: alert.level,
      message: alert.message,
      notified,
    })),
  );
  return { fresh, notified };
}

/** One monitor run: checks, snapshot, alerts; and the daily chores. */
export async function runMonitor(
  admin: Admin,
  now: Date,
  { daily = false }: { daily?: boolean } = {},
): Promise<{
  status: ReturnType<typeof healthStatus>;
  alerts: number;
  sent: number;
}> {
  const health = await runHealthChecks(true);
  const status = healthStatus(health);
  await admin
    .from("health_checks")
    .insert({ status, checks: health, checked_at: now.toISOString() });
  const snapshot = await collectSnapshot(admin, health, now);
  const alerts = evaluateAlerts(snapshot);
  const { fresh } = await recordAlerts(admin, alerts, now);
  if (daily) {
    await Promise.all([
      admin.rpc("prune_logs"),
      admin.from("ops_samples").upsert({
        day: usageDay(now),
        database_bytes: snapshot.databaseBytes,
        storage_bytes: snapshot.storageBytes,
      }),
    ]);
  }
  return { status, alerts: alerts.length, sent: fresh.length };
}

/** The latest health check, for the status page; null when none yet. */
export async function latestHealth(): Promise<{
  status: "ok" | "degraded" | "down";
  checkedAt: string;
} | null> {
  const admin = getAdminSupabase();
  if (!admin) return null;
  const { data } = await admin
    .from("health_checks")
    .select("status, checked_at")
    .order("checked_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    status: data.status as "ok" | "degraded" | "down",
    checkedAt: data.checked_at,
  };
}
