import { cache } from "react";
import type { Supabase } from "@/lib/supabase/browser";
import { DEFAULT_USAGE_SETTINGS, type UsageSettings } from "@/lib/usage";

/**
 * The AI cost limits admins set on /admin/usage (D77), read with the
 * secret key once per request; the defaults when the row can't be read,
 * so a settings problem never lifts a limit.
 */
export const getUsageSettings = cache(
  async (admin: Supabase): Promise<UsageSettings> => {
    try {
      const { data, error } = await admin
        .from("usage_settings")
        .select(
          "admin_manual_micros, admin_batch_micros, paid_micros, free_micros, site_monthly_micros",
        )
        .eq("id", 1)
        .maybeSingle();
      if (error || !data) return DEFAULT_USAGE_SETTINGS;
      return {
        adminManualMicros: data.admin_manual_micros,
        adminBatchMicros: data.admin_batch_micros,
        paidMicros: data.paid_micros,
        freeMicros: data.free_micros,
        siteMonthlyMicros: data.site_monthly_micros,
      };
    } catch {
      return DEFAULT_USAGE_SETTINGS;
    }
  },
);
