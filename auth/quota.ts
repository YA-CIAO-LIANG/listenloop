import { cache } from "react";
import {
  classStudentWriting,
  isClassSeats,
  type ClassTier,
} from "@/lib/classroom";
import {
  isPlanLine,
  PLANS,
  planFor,
  type PlanId,
  type PlanLimits,
} from "@/lib/plans";
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

type StudentWriting = ClassTier["perStudent"];

/**
 * The writing AI a learner's class plans give them a week (D210): for
 * each class they're in whose teacher's plan has writing, the most of
 * each allowance. Null when none.
 */
export const getClassWriting = cache(
  async (userId: string): Promise<StudentWriting | null> => {
    const admin = getAdminSupabase();
    if (!admin) return null;
    const { data: memberships } = await admin
      .from("class_members")
      .select("classes!inner(teacher_id, archived_at)")
      .eq("user_id", userId);
    const teachers = [
      ...new Set(
        (memberships ?? []).flatMap((m) => {
          const c = m.classes as unknown as {
            teacher_id: string;
            archived_at: string | null;
          } | null;
          return c && c.archived_at === null ? [c.teacher_id] : [];
        }),
      ),
    ];
    if (teachers.length === 0) return null;
    const { data: profiles } = await admin
      .from("profiles")
      .select("classroom_seats, classroom_line")
      .in("user_id", teachers);
    let best: StudentWriting | null = null;
    for (const p of profiles ?? []) {
      const given = classStudentWriting(
        isClassSeats(p.classroom_seats) ? p.classroom_seats : null,
        isPlanLine(p.classroom_line) ? p.classroom_line : "all",
      );
      if (!given) continue;
      best = best
        ? {
            essaysPerWeek: Math.max(best.essaysPerWeek, given.essaysPerWeek),
            backChecksPerWeek: Math.max(
              best.backChecksPerWeek,
              given.backChecksPerWeek,
            ),
            chatMessagesPerWeek: Math.max(
              best.chatMessagesPerWeek,
              given.chatMessagesPerWeek,
            ),
          }
        : given;
    }
    return best;
  },
);

/** The larger of a plan's limit and a class's (null is unlimited). */
const atLeast = (own: number | null, given: number) =>
  own === null ? null : Math.max(own, given);

/** A plan's limits with a class plan's writing for its students (D210). */
export function withClassWriting(
  limits: PlanLimits,
  given: StudentWriting | null,
): PlanLimits {
  if (!given) return limits;
  return {
    ...limits,
    writingReviewsPerWeek: atLeast(
      limits.writingReviewsPerWeek,
      given.essaysPerWeek,
    ),
    backChecksPerWeek: atLeast(
      limits.backChecksPerWeek,
      given.backChecksPerWeek,
    ),
    chatMessagesPerWeek: atLeast(
      limits.chatMessagesPerWeek,
      given.chatMessagesPerWeek,
    ),
  };
}

/**
 * The plan table with this account's plan adjusted (for `can`): a class
 * plan's writing for its students (D210), then an admin's changes (D161).
 */
export async function plansFor(
  user: SignedInUser,
  base: Readonly<Record<PlanId, PlanLimits>> = PLANS,
): Promise<Readonly<Record<PlanId, PlanLimits>>> {
  const plan = planFor(user);
  if (plan === "admin") return base;
  const [overrides, classWriting] = await Promise.all([
    getQuotaOverrides(user.id),
    getClassWriting(user.id),
  ]);
  if (overrides.length === 0 && !classWriting) return base;
  return {
    ...base,
    [plan]: withOverrides(
      withClassWriting(base[plan], classWriting),
      overrides,
      new Date(),
    ),
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
