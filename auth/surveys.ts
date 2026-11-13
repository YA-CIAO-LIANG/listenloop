import { npsOf, type NpsSummary } from "@/lib/survey";
import { getAdminSupabase } from "./admin";

export type SurveyRow = {
  id: string;
  createdAt: string;
  userId: string;
  videoId: string;
  week: number;
  score: number;
  comment: string | null;
};

/**
 * The Day 7 survey's answers (D164), newest first, with the summary
 * (Net Promoter Score, average). Read with the secret key; admin pages
 * only. `userIds` limits it to some accounts (the Beta testers).
 */
export async function getSurveys({
  limit = 500,
  userIds,
}: { limit?: number; userIds?: string[] } = {}): Promise<{
  rows: SurveyRow[];
  summary: NpsSummary;
}> {
  const admin = getAdminSupabase();
  if (!admin || userIds?.length === 0) return { rows: [], summary: npsOf([]) };
  let query = admin
    .from("week_surveys")
    .select("id, created_at, user_id, video_id, week, score, comment")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (userIds) query = query.in("user_id", userIds);
  const { data } = await query;
  const rows = (data ?? []).map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    userId: r.user_id,
    videoId: r.video_id,
    week: r.week,
    score: r.score,
    comment: r.comment,
  }));
  return { rows, summary: npsOf(rows.map((r) => r.score)) };
}
