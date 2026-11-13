"use server";

import { getAdminSupabase } from "@/auth/admin";
import { allowAction } from "@/auth/rate-limit";
import { getSignedInUser } from "@/auth/session";
import { cleanSurvey } from "@/lib/survey";

export type WeekSurveyResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "signedOut" | "limit" | "failed" };

/**
 * Saves the Day 7 survey (D164) for the signed-in account; answering the
 * same week again keeps the first answer.
 */
export async function submitWeekSurvey(
  raw: unknown,
): Promise<WeekSurveyResult> {
  const input = cleanSurvey(raw);
  if (!input) return { ok: false, reason: "invalid" };
  const user = await getSignedInUser();
  if (!user) return { ok: false, reason: "signedOut" };
  const admin = getAdminSupabase();
  if (!admin) return { ok: false, reason: "failed" };
  if (!(await allowAction("feedback", user.id))) {
    return { ok: false, reason: "limit" };
  }
  const { error } = await admin.from("week_surveys").upsert(
    {
      user_id: user.id,
      video_id: input.videoId,
      week: input.week,
      score: input.score,
      comment: input.comment,
    },
    { onConflict: "user_id,video_id,week", ignoreDuplicates: true },
  );
  return error ? { ok: false, reason: "failed" } : { ok: true };
}
