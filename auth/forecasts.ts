import { SUPABASE_FREE } from "@/lib/admin-dashboard";
import {
  capacityForecast,
  creditForecast,
  type CapacityForecast,
  type CreditForecast,
} from "@/lib/ops/forecast";
import { usageDay } from "@/lib/usage";
import { AZURE_CREDIT } from "@/lib/usage-report";
import type { getAdminSupabase } from "./admin";

type Admin = NonNullable<ReturnType<typeof getAdminSupabase>>;

export type Forecasts = {
  credit: CreditForecast;
  database: CapacityForecast | null;
  storage: CapacityForecast | null;
};

/**
 * The Azure credit and Supabase forecasts (D156) from the last 30 days
 * of spend and the daily size samples.
 */
export async function loadForecasts(
  admin: Admin,
  now: Date,
  azureMicros: number,
): Promise<Forecasts> {
  const dayStart = new Date(`${usageDay(now)}T00:00:00+08:00`).toISOString();
  const [{ data: days }, { data: samples }] = await Promise.all([
    admin.rpc("daily_api_cost", { day_start: dayStart, days: 30 }),
    admin
      .from("ops_samples")
      .select("day, database_bytes, storage_bytes")
      .order("day", { ascending: false })
      .limit(30),
  ]);
  const rows = samples ?? [];
  return {
    credit: creditForecast({
      dailyMicros: (days ?? []).map((d) => Number(d.micros) || 0),
      creditMicros: AZURE_CREDIT.usd * 1e6,
      spentMicros: azureMicros,
      endsOn: AZURE_CREDIT.endsOn,
      today: now,
    }),
    database: capacityForecast(
      rows.map((r) => ({ day: r.day, bytes: Number(r.database_bytes) })),
      SUPABASE_FREE.databaseBytes,
    ),
    storage: capacityForecast(
      rows.map((r) => ({ day: r.day, bytes: Number(r.storage_bytes) })),
      SUPABASE_FREE.storageBytes,
    ),
  };
}
