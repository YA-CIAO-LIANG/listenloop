import { OPS_THRESHOLDS } from "./thresholds";

/**
 * Monitoring (D156): from a snapshot of the site's numbers, what needs
 * attention. Pure, so every rule is tested; the cron route gathers the
 * snapshot and sends the alerts.
 */

export const HEALTH_CHECK_NAMES = [
  "db",
  "storage",
  "ai",
  "speech",
  "config",
] as const;
export type HealthCheckName = (typeof HEALTH_CHECK_NAMES)[number];
export type CheckResult = "ok" | "fail" | "skipped";
export type HealthChecks = Record<HealthCheckName, CheckResult>;

export type OpsSnapshot = {
  health: HealthChecks;
  errors15m: number;
  /** Server errors in the 7 days before the last 15 minutes. */
  errors7d: number;
  todayMicros: number;
  /** Spend on each of the 7 days before today (fewer when the site is new). */
  previousDaysMicros: number[];
  monthMicros: number;
  monthCapMicros: number;
  speechCharsMonth: number;
  speechCharsCap: number;
  audioSecondsMonth: number;
  audioSecondsCap: number;
  databaseBytes: number;
  databaseCap: number;
  storageBytes: number;
  storageCap: number;
  signups1h: number;
  reports1h: number;
};

export type AlertLevel = "warning" | "critical";

export type OpsAlert = {
  /** Stable for the same problem, so it isn't sent again for a while. */
  key: string;
  level: AlertLevel;
  /** Plain text without personal data (it may go to Discord). */
  message: string;
};

const pct = (share: number) => `${Math.round(share * 100)}%`;
export const usd = (micros: number) => `US$${(micros / 1e6).toFixed(2)}`;
const mb = (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`;

function shareAlert(
  key: string,
  label: string,
  used: number,
  cap: number,
  format: (n: number) => string,
): OpsAlert | null {
  if (cap <= 0) return null;
  const share = used / cap;
  if (share >= 1) {
    return {
      key: `${key}:full`,
      level: "critical",
      message: `${label}已用完：${format(used)} / ${format(cap)}`,
    };
  }
  if (share >= OPS_THRESHOLDS.quotaWarnShare) {
    return {
      key: `${key}:80`,
      level: "warning",
      message: `${label}已用 ${pct(share)}：${format(used)} / ${format(cap)}`,
    };
  }
  return null;
}

export function evaluateAlerts(s: OpsSnapshot): OpsAlert[] {
  const alerts: OpsAlert[] = [];
  const failed = HEALTH_CHECK_NAMES.filter((name) => s.health[name] === "fail");
  if (failed.length > 0) {
    alerts.push({
      key: `health:${failed.join(",")}`,
      level: failed.includes("db") ? "critical" : "warning",
      message: `健康檢查失敗：${failed.join("、")}`,
    });
  }

  // 7 days hold 672 quarter-hours.
  const usual = s.errors7d / 672;
  if (
    s.errors15m >= OPS_THRESHOLDS.errorBurstMin &&
    s.errors15m >= usual * OPS_THRESHOLDS.errorBurstFactor
  ) {
    alerts.push({
      key: "errors:burst",
      level: "critical",
      message: `錯誤率突然升高：最近 15 分鐘 ${s.errors15m} 筆（平常約 ${usual.toFixed(1)} 筆）`,
    });
  }

  for (const alert of [
    shareAlert(
      "ai-month",
      "全站本月 AI 額度",
      s.monthMicros,
      s.monthCapMicros,
      usd,
    ),
    shareAlert(
      "speech-month",
      "本月 Azure 語音免費字數",
      s.speechCharsMonth,
      s.speechCharsCap,
      (n) => n.toLocaleString("en-US"),
    ),
    shareAlert(
      "transcribe-month",
      "本月語音轉文字時數",
      s.audioSecondsMonth,
      s.audioSecondsCap,
      (n) => `${(n / 3600).toFixed(1)} 小時`,
    ),
  ]) {
    if (alert) alerts.push(alert);
  }

  if (s.previousDaysMicros.length > 0) {
    const average =
      s.previousDaysMicros.reduce((a, b) => a + b, 0) /
      s.previousDaysMicros.length;
    if (
      s.todayMicros >= OPS_THRESHOLDS.spendSpikeMinMicros &&
      s.todayMicros > average * OPS_THRESHOLDS.spendSpikeFactor
    ) {
      alerts.push({
        key: "spend:spike",
        level: "warning",
        message: `今日花費異常：${usd(s.todayMicros)}，過去 7 天平均 ${usd(average)}`,
      });
    }
  }

  for (const [key, label, used, cap] of [
    ["supabase-db", "Supabase 資料庫", s.databaseBytes, s.databaseCap],
    ["supabase-storage", "Supabase 檔案儲存", s.storageBytes, s.storageCap],
  ] as const) {
    if (cap > 0 && used / cap >= OPS_THRESHOLDS.supabaseWarnShare) {
      alerts.push({
        key: `${key}:80`,
        level: used >= cap ? "critical" : "warning",
        message: `${label}接近免費上限：${mb(used)} / ${mb(cap)}（${pct(used / cap)}）`,
      });
    }
  }

  if (s.signups1h >= OPS_THRESHOLDS.signupsPerHour) {
    alerts.push({
      key: "signups:burst",
      level: "warning",
      message: `短時間大量註冊：最近 1 小時 ${s.signups1h} 個新帳號`,
    });
  }
  if (s.reports1h >= OPS_THRESHOLDS.reportsPerHour) {
    alerts.push({
      key: "reports:burst",
      level: "warning",
      message: `短時間大量檢舉：最近 1 小時 ${s.reports1h} 筆`,
    });
  }
  return alerts;
}

/** Alerts not sent in the last `repeatHours` (by key). */
export function newAlerts(
  alerts: OpsAlert[],
  recentlySent: { key: string; created_at: string }[],
  now: Date,
): OpsAlert[] {
  const since = now.getTime() - OPS_THRESHOLDS.repeatHours * 3_600_000;
  const recent = new Set(
    recentlySent
      .filter((row) => Date.parse(row.created_at) >= since)
      .map((row) => row.key),
  );
  return alerts.filter((alert) => !recent.has(alert.key));
}

/** The overall state from the health checks. */
export function healthStatus(checks: HealthChecks): "ok" | "degraded" | "down" {
  if (checks.db === "fail") return "down";
  return Object.values(checks).includes("fail") ? "degraded" : "ok";
}
