/**
 * The short survey after a week's Day 7 (D164): how likely to recommend
 * ListenLoop, 0–10 (the Net Promoter question), and one optional open
 * question. One answer per account, material, and week.
 */
export const SURVEY_COMMENT_MAX = 1000;
export const SURVEY_SCORES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export type SurveyInput = {
  videoId: string;
  week: number;
  score: number;
  comment: string | null;
};

export function cleanSurvey(raw: unknown): SurveyInput | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const score = r.score;
  const week = r.week;
  const videoId = typeof r.videoId === "string" ? r.videoId.trim() : "";
  if (
    typeof score !== "number" ||
    !Number.isInteger(score) ||
    score < 0 ||
    score > 10
  )
    return null;
  if (typeof week !== "number" || !Number.isInteger(week) || week < 1)
    return null;
  if (!/^[a-z0-9-]{1,80}$/.test(videoId)) return null;
  const comment =
    typeof r.comment === "string"
      ? r.comment.trim().slice(0, SURVEY_COMMENT_MAX)
      : "";
  return { videoId, week, score, comment: comment || null };
}

export type NpsSummary = {
  count: number;
  promoters: number;
  passives: number;
  detractors: number;
  /** Net Promoter Score: % promoters (9–10) minus % detractors (0–6). */
  nps: number | null;
  average: number | null;
};

export function npsOf(scores: readonly number[]): NpsSummary {
  const count = scores.length;
  const promoters = scores.filter((s) => s >= 9).length;
  const detractors = scores.filter((s) => s <= 6).length;
  return {
    count,
    promoters,
    passives: count - promoters - detractors,
    detractors,
    nps: count ? Math.round(((promoters - detractors) / count) * 100) : null,
    average: count
      ? Math.round((scores.reduce((a, b) => a + b, 0) / count) * 10) / 10
      : null,
  };
}

/** This device's answered or skipped surveys (localStorage). */
export const SURVEY_STORAGE_KEY = "ll-week-survey:v1";
export const surveyKey = (videoId: string, week: number) =>
  `${videoId}:w${week}`;
