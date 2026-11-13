import { cache } from "react";
import { PLANS, planFor, type PlanId, type PlanLimits } from "@/lib/plans";
import { parseOverride, withOverrides, type QuotaOverride } from "@/lib/quota";
import { UPLOADS_BUCKET } from "@/lib/supabase/config";
import { usageDay } from "@/lib/usage";
import { getAdminSupabase } from "./admin";
import type { SignedInUser } from "./session";

/**
 * One account's limits (D161): its plan's, plus the changes an admin
 * made that are still in force. Read with the secret key, once per
 * request; none when it can't be read (the plan's limits apply).
 */
export const getQuotaOverrides = cache(
  async (userId: string): Promise<QuotaOverride[]> => {
    const admin = getAdminSupabase();
    if (!admin) return [];
    const { data } = await admin
      .from("quota_overrides")
      .select("limit_name, extra, expires_at")
      .eq("user_id", userId)
      .gt("expires_at", new Date().toISOString());
    return (data ?? []).flatMap((row) => parseOverride(row) ?? []);
  },
);

/** The plan table with this account's plan adjusted (for `can`). */
export async function plansFor(
  user: SignedInUser,
  base: Readonly<Record<PlanId, PlanLimits>> = PLANS,
): Promise<Readonly<Record<PlanId, PlanLimits>>> {
  const plan = planFor(user);
  if (plan === "admin") return base;
  const overrides = await getQuotaOverrides(user.id);
  if (overrides.length === 0) return base;
  return {
    ...base,
    [plan]: withOverrides(base[plan], overrides, new Date()),
  };
}

/** Bytes of recordings this account has stored (uploads/<id>/). */
export async function storedUploadBytes(userId: string): Promise<number> {
  const admin = getAdminSupabase();
  if (!admin) return 0;
  const { data } = await admin.storage
    .from(UPLOADS_BUCKET)
    .list(userId, { limit: 1000 });
  return (data ?? []).reduce(
    (sum, file) => sum + (Number(file.metadata?.size) || 0),
    0,
  );
}

/**
 * "Revise with an instruction" steps today (Taiwan day), from the API
 * call log; the automatic shortening of new text (D153) doesn't count.
 */
export async function revisesToday(userId: string): Promise<number> {
  const admin = getAdminSupabase();
  if (!admin) return 0;
  const start = new Date(`${usageDay(new Date())}T00:00:00+08:00`);
  const { count } = await admin
    .from("api_calls")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("operation", "revise")
    .gte("created_at", start.toISOString())
    .not("outcome", "like", "shorten%");
  return count ?? 0;
}
