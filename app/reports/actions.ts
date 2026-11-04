"use server";

import { getServerSupabase } from "@/auth/server";
import { getSignedInUser } from "@/auth/session";
import {
  cleanReportDetails,
  isReportReason,
  REPORT_LIMITS,
} from "@/lib/moderation";
import { parseCustomPracticeId } from "@/lib/practice-material";
import { usageDay } from "@/lib/usage";

export type ReportResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        "signed-out" | "invalid" | "not-found" | "already" | "limit" | "failed";
    };

/**
 * Reports someone else's public practice (D31). Signed-in users only, at
 * most REPORT_LIMITS.perDay a day and one open report per practice; row
 * level security refuses practices that aren't public or are the
 * reporter's own, which reads as not found.
 */
export async function reportPractice(
  practiceId: unknown,
  reason: unknown,
  details: unknown,
): Promise<ReportResult> {
  const uuid =
    typeof practiceId === "string" ? parseCustomPracticeId(practiceId) : null;
  const text = cleanReportDetails(details);
  if (!uuid || !isReportReason(reason) || text === null) {
    return { ok: false, reason: "invalid" };
  }
  const [user, supabase] = await Promise.all([
    getSignedInUser(),
    getServerSupabase(),
  ]);
  if (!user || !supabase) return { ok: false, reason: "signed-out" };

  // Today in Taiwan time, like the usage limits (D7).
  const since = `${usageDay(new Date())}T00:00:00+08:00`;
  const { count, error: countError } = await supabase
    .from("practice_reports")
    .select("id", { count: "exact", head: true })
    .eq("reporter_id", user.id)
    .gte("created_at", since);
  if (countError) return { ok: false, reason: "failed" };
  if ((count ?? 0) >= REPORT_LIMITS.perDay) {
    return { ok: false, reason: "limit" };
  }

  const { error } = await supabase
    .from("practice_reports")
    .insert({ practice_id: uuid, reporter_id: user.id, reason, details: text });
  if (!error) return { ok: true };
  // 23505: the one-open-report index; 42501: row level security.
  if (error.code === "23505") return { ok: false, reason: "already" };
  if (error.code === "42501") return { ok: false, reason: "not-found" };
  return { ok: false, reason: "failed" };
}
