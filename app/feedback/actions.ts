"use server";

import { getAdminSupabase } from "@/auth/admin";
import { allowAction } from "@/auth/rate-limit";
import { getSignedInUser } from "@/auth/session";
import { cleanFeedback, FEEDBACK_PER_DAY } from "@/lib/feedback";
import { usageDay } from "@/lib/usage";

export type FeedbackResult =
  { ok: true } | { ok: false; reason: "invalid" | "limit" | "failed" };

/**
 * Saves feedback from the footer's form (D60), with the sender's account
 * when signed in. Signed in, at most FEEDBACK_PER_DAY a day; signed-out
 * senders are limited by the request rate limit (D61).
 */
export async function submitFeedback(raw: unknown): Promise<FeedbackResult> {
  const input = cleanFeedback(raw);
  if (!input) return { ok: false, reason: "invalid" };
  const admin = getAdminSupabase();
  if (!admin) return { ok: false, reason: "failed" };
  const user = await getSignedInUser();
  if (!(await allowAction("feedback", user?.id ?? null))) {
    return { ok: false, reason: "limit" };
  }
  if (user) {
    const { count } = await admin
      .from("feedback")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", `${usageDay(new Date())}T00:00:00+08:00`);
    if ((count ?? 0) >= FEEDBACK_PER_DAY) return { ok: false, reason: "limit" };
  }
  const { error } = await admin.from("feedback").insert({
    user_id: user?.id ?? null,
    category: input.category,
    message: input.message,
    page: input.page,
  });
  return error ? { ok: false, reason: "failed" } : { ok: true };
}
