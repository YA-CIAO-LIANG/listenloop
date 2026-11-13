import { usd } from "./alerts";
import type { CapacityForecast, CreditForecast } from "./forecast";

/**
 * The weekly usage and cost summary (D156): built every Monday by the
 * cron route, kept in weekly_reports, shown on /admin/usage and sent to
 * Discord when it's set up. Counts and amounts only.
 */

export type OperationCost = {
  provider: string;
  operation: string;
  calls: number;
  micros: number;
};

export type WeeklySummary = {
  /** YYYY-MM-DD, Monday (Taiwan), and the Sunday it ends on. */
  weekStart: string;
  weekEnd: string;
  totalMicros: number;
  byOperation: OperationCost[];
  newUsers: number;
  newPractices: number;
  activeUsers: number;
  credit: CreditForecast;
  database: CapacityForecast | null;
  storage: CapacityForecast | null;
};

export function parseOperations(raw: unknown): OperationCost[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const r = row as Record<string, unknown>;
    if (typeof r.provider !== "string" || typeof r.operation !== "string") {
      return [];
    }
    return [
      {
        provider: r.provider,
        operation: r.operation,
        calls: Number(r.calls) || 0,
        micros: Number(r.micros) || 0,
      },
    ];
  });
}

export function parseWeeklySummary(raw: unknown): WeeklySummary | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as WeeklySummary;
  return typeof s.weekStart === "string" &&
    typeof s.totalMicros === "number" &&
    Array.isArray(s.byOperation) &&
    s.credit &&
    typeof s.credit === "object"
    ? s
    : null;
}

const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(0)} MB`;

/** The summary as Discord lines (Chinese, like the admin's dashboard). */
export function weeklyLines(s: WeeklySummary): string[] {
  const top = [...s.byOperation]
    .sort((a, b) => b.micros - a.micros)
    .slice(0, 5)
    .map(
      (o) => `・${o.provider} ${o.operation}：${o.calls} 次，${usd(o.micros)}`,
    );
  const fill = (label: string, f: CapacityForecast | null) =>
    f
      ? `${label}：${megabytes(f.latestBytes)}，${f.fullOn ? `照目前速度約 ${f.fullOn} 滿` : "沒有成長"}`
      : `${label}：還沒有資料`;
  return [
    `期間：${s.weekStart} ～ ${s.weekEnd}`,
    `AI 與語音花費：${usd(s.totalMicros)}`,
    ...top,
    `新帳號 ${s.newUsers}、新教材 ${s.newPractices}、活躍學習者 ${s.activeUsers}`,
    `Azure 學生額度剩 ${usd(s.credit.leftMicros)}；${
      s.credit.runsOutOn && !s.credit.expiresFirst
        ? `照最近的速度約 ${s.credit.runsOutOn} 用完`
        : "到期前用不完"
    }`,
    fill("Supabase 資料庫", s.database),
    fill("Supabase 檔案儲存", s.storage),
  ];
}
