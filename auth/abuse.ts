import { userNumberLabel } from "@/lib/accounts";
import type { OpsAlert } from "@/lib/ops/alerts";
import {
  ABUSE,
  detectAbuse,
  parseAbuseSignals,
  type AbuseKind,
} from "@/lib/ops/abuse";
import { isAccountPlan } from "@/lib/plans";
import { dailyCostLimit, usageDay } from "@/lib/usage";
import type { getAdminSupabase } from "./admin";
import { getUsageSettings } from "./usage-settings";

type Admin = NonNullable<ReturnType<typeof getAdminSupabase>>;

const KIND_TEXT: Record<AbuseKind, string> = {
  "multi-signup": "同一個 IP 一天內建立多個帳號",
  "heavy-use": "1 小時內大量 AI 呼叫，已自動暫停 AI",
  "capped-days": "連續 3 天接近每日 AI 上限",
  reported: "公開教材被多人檢舉，已自動暫停 AI",
};

/**
 * Runs abuse detection (D162) with the monitor: new flags are saved
 * (one open per account and kind), accounts that need it get AI paused,
 * and each new flag becomes an alert with the account number only.
 */
export async function runAbuseDetection(
  admin: Admin,
  now: Date,
): Promise<OpsAlert[]> {
  const dayStart = new Date(`${usageDay(now)}T00:00:00+08:00`).toISOString();
  const { data, error } = await admin.rpc("abuse_signals", {
    day_start: dayStart,
    heavy_calls: ABUSE.heavyCallsPerHour,
  });
  if (error) return [];
  const signals = parseAbuseSignals(data);
  const ids = [
    ...new Set([
      ...signals.signups.flatMap((s) => s.users),
      ...signals.heavy.map((h) => h.user),
      ...signals.days.map((d) => d.user),
      ...signals.reported.map((r) => r.user),
    ]),
  ];
  if (ids.length === 0) return [];
  const [{ data: profiles }, settings, { data: open }] = await Promise.all([
    admin
      .from("profiles")
      .select("user_id, number, role, plan, ai_suspended_at")
      .in("user_id", ids),
    getUsageSettings(admin),
    admin
      .from("abuse_flags")
      .select("user_id, kind")
      .eq("status", "open")
      .in("user_id", ids),
  ]);
  const byId = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  const flags = detectAbuse(signals, (userId) => {
    const p = byId.get(userId);
    if (!p || p.role === "admin") return null;
    return dailyCostLimit(
      settings,
      isAccountPlan(p.plan) ? p.plan : "free",
      "manual",
    );
  });
  const already = new Set((open ?? []).map((f) => `${f.user_id}:${f.kind}`));
  const fresh = flags.filter((f) => !already.has(`${f.userId}:${f.kind}`));
  const alerts: OpsAlert[] = [];
  for (const flag of fresh) {
    const profile = byId.get(flag.userId);
    const suspend = flag.suspend && !profile?.ai_suspended_at;
    const { error: insertError } = await admin.from("abuse_flags").insert({
      user_id: flag.userId,
      kind: flag.kind,
      detail: flag.detail,
      auto_suspended: suspend,
    });
    if (insertError) continue;
    if (suspend) {
      await admin
        .from("profiles")
        .update({
          ai_suspended_at: now.toISOString(),
          ai_suspended_reason: `自動暫停（${flag.kind}），等待管理員確認`,
        })
        .eq("user_id", flag.userId);
    }
    const who = profile ? userNumberLabel(profile.number) : "某帳號";
    alerts.push({
      key: `abuse:${flag.kind}:${profile?.number ?? flag.userId.slice(0, 8)}`,
      level: flag.suspend ? "critical" : "warning",
      message: `濫用偵測：${who}，${KIND_TEXT[flag.kind]}（到後台「濫用標記」確認）`,
    });
  }
  return alerts;
}
