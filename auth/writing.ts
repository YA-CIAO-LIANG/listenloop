import { usageWeek } from "@/lib/usage-report";
import { getAdminSupabase } from "./admin";

/**
 * AI essay reviews (WritingLoop, D187) this account used this week, from
 * Monday 00:00 Taiwan time: the api_calls log's successful "writing"
 * calls, so no table of its own is needed.
 */
export async function writingReviewsThisWeek(userId: string): Promise<number> {
  const admin = getAdminSupabase();
  if (!admin) return 0;
  const { count } = await admin
    .from("api_calls")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("operation", "writing")
    .is("error", null)
    .gte("created_at", usageWeek(new Date()).start);
  return count ?? 0;
}
