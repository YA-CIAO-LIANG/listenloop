import { FEEDBACK_PER_DAY } from "@/lib/feedback";
import { REPORT_LIMITS } from "@/lib/moderation";
import { planFor, type PlanId } from "@/lib/plans";
import {
  activeOverrides,
  parseOverride,
  type QuotaOverride,
} from "@/lib/quota";
import { RATE_LIMITS } from "@/lib/rate-limits";
import type { ReferralSummary } from "@/lib/referral";
import {
  dailyCostLimit,
  nextUsageDay,
  usageDay,
  usageMonth,
} from "@/lib/usage";
import { getAdminSupabase } from "./admin";
import { creationAllowance } from "./creation-quota";
import { revisesToday, storedUploadBytes } from "./quota";
import { backChecksThisWeek, writingReviewsThisWeek } from "./writing";
import { chatMinutesThisWeek } from "./chat";
import { usageWeek } from "@/lib/usage-report";
import { referralSummary } from "./referral";
import type { SignedInUser } from "./session";
import { getUsageSettings } from "./usage-settings";

/**
 * Everything "My quota" shows (D161): each allowance used, left, and
 * when it resets, from the same numbers the checks use.
 */
export type QuotaRow = {
  id:
    | "minutesPerWeek"
    | "minutesPerMonth"
    | "revisesPerDay"
    | "storageMegabytes"
    | "dailyAi"
    | "writingReviewsPerWeek"
    | "chatMinutesPerWeek"
    | "backChecksPerWeek";
  used: number;
  /** null: unlimited. */
  max: number | null;
  unit: "minutes" | "times" | "megabytes" | "percent";
  /** ISO time it resets; null for storage (it frees up when deleted). */
  resetsAt: string | null;
};

export type QuotaReport = {
  plan: PlanId;
  rows: QuotaRow[];
  /** Fixed limits (no counting), for the table under the meters. */
  fixed: {
    charsPerPractice: number | null;
    maxPracticeSeconds: number | null;
    uploadMegabytes: number | null;
    uploadAudio: boolean;
    reportsPerDay: number;
    feedbackPerDay: number;
    aiPerHour: number;
    /** WritingLoop's longest essay for feedback (D187). */
    writingWords: number | null;
  };
  overrides: (QuotaOverride & { reason: string })[];
  aiSuspended: string | null;
  /** The referral program (D177); null without the database. */
  referral: ReferralSummary | null;
};

export async function quotaReport(user: SignedInUser): Promise<QuotaReport> {
  const plan = planFor(user);
  const now = new Date();
  const admin = getAdminSupabase();
  const [
    allowance,
    revises,
    stored,
    settings,
    todayCost,
    overrideRows,
    referral,
    writingReviews,
    chatMinutes,
    backChecks,
  ] = await Promise.all([
    creationAllowance({ user }),
    revisesToday(user.id),
    storedUploadBytes(user.id),
    admin ? getUsageSettings(admin) : Promise.resolve(null),
    admin
      ? admin
          .from("api_daily_cost")
          .select("micros")
          .eq("user_id", user.id)
          .eq("day", usageDay(now))
          .maybeSingle()
      : Promise.resolve({ data: null }),
    admin
      ? admin
          .from("quota_overrides")
          .select("limit_name, extra, expires_at, reason")
          .eq("user_id", user.id)
          .gt("expires_at", now.toISOString())
          .order("expires_at")
      : Promise.resolve({ data: null }),
    referralSummary(user.id),
    writingReviewsThisWeek(user.id),
    chatMinutesThisWeek(user.id),
    backChecksThisWeek(user.id),
  ]);
  const limits = allowance.plans[plan];
  const tomorrow = nextUsageDay(now).toISOString();
  const nextMonth = usageMonth(now).next.toISOString();
  const rows: QuotaRow[] = [];
  if (limits.minutesPerWeek !== null) {
    rows.push({
      id: "minutesPerWeek",
      used: Math.round(allowance.made.weekSeconds / 60),
      max: limits.minutesPerWeek,
      unit: "minutes",
      resetsAt: allowance.week?.resetsAt ?? null,
    });
  }
  if (limits.minutesPerMonth !== null || limits.minutesPerWeek === null) {
    rows.push({
      id: "minutesPerMonth",
      used: Math.round(allowance.made.seconds / 60),
      max: limits.minutesPerMonth,
      unit: "minutes",
      resetsAt: nextMonth,
    });
  }
  rows.push({
    id: "revisesPerDay",
    used: revises,
    max: limits.revisesPerDay,
    unit: "times",
    resetsAt: tomorrow,
  });
  if (limits.uploadAudio) {
    rows.push({
      id: "storageMegabytes",
      used: Math.round((stored / 1024 / 1024) * 10) / 10,
      max: limits.storageMegabytes,
      unit: "megabytes",
      resetsAt: null,
    });
  }
  // WritingLoop's AI essay reviews, shown apart (D187, D188).
  rows.push({
    id: "writingReviewsPerWeek",
    used: writingReviews,
    max: limits.writingReviewsPerWeek,
    unit: "times",
    resetsAt: usageWeek(now).end,
  });
  // Chat practice minutes (D197).
  rows.push({
    id: "chatMinutesPerWeek",
    used: chatMinutes,
    max: limits.chatMinutesPerWeek,
    unit: "minutes",
    resetsAt: usageWeek(now).end,
  });
  // AI checks of extra practice, shown apart (D200).
  rows.push({
    id: "backChecksPerWeek",
    used: backChecks,
    max: limits.backChecksPerWeek,
    unit: "times",
    resetsAt: usageWeek(now).end,
  });
  if (settings) {
    const cap = dailyCostLimit(settings, plan, "manual");
    const spent = Number(todayCost.data?.micros ?? 0);
    rows.push({
      id: "dailyAi",
      used: cap ? Math.min(100, Math.round((spent / cap) * 100)) : 0,
      max: cap ? 100 : null,
      unit: "percent",
      resetsAt: tomorrow,
    });
  }
  const overrides = (overrideRows.data ?? []).flatMap((row) => {
    const parsed = parseOverride(row);
    return parsed ? [{ ...parsed, reason: String(row.reason ?? "") }] : [];
  });
  return {
    plan,
    rows,
    fixed: {
      charsPerPractice: limits.charsPerPractice,
      maxPracticeSeconds: limits.maxPracticeSeconds,
      uploadMegabytes: limits.uploadMegabytes,
      uploadAudio: limits.uploadAudio,
      reportsPerDay: REPORT_LIMITS.perDay,
      feedbackPerDay: FEEDBACK_PER_DAY,
      aiPerHour: RATE_LIMITS.ai.max,
      writingWords: limits.writingWords,
    },
    overrides: activeOverrides(overrides, now),
    aiSuspended: user.aiSuspended ?? null,
    referral: referral && {
      ...referral,
      leftMinutes: Math.round((allowance.bonusLeftSeconds ?? 0) / 6) / 10,
    },
  };
}
