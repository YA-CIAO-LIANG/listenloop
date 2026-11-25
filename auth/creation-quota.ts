import { classMinutes, isClassSeats } from "@/lib/classroom";
import {
  can,
  needsCount,
  PLANS,
  planFor,
  weekSecondsLeft,
  type PlanCheck,
  type PlanId,
  type PlanLimits,
} from "@/lib/plans";
import {
  bonusLimit,
  bonusPool,
  withBonus,
  type CreationRecord,
} from "@/lib/referral";
import { WORDS_PER_MINUTE, wordsToSeconds } from "@/lib/units";
import { usagePeriodStarts, usageWeek } from "@/lib/usage-report";
import { plansFor } from "./quota";
import { getReferralGrants } from "./referral";
import type { SignedInUser } from "./session";
import { getServerSupabase } from "./server";

/** The free plan's week (D143): what's made, what's left, when it resets. */
export type WeekAllowance = {
  usedSeconds: number;
  leftSeconds: number;
  /** The week's allowance in words (D209). */
  words: number;
  /** ISO instant: next Monday 00:00 Taiwan time. */
  resetsAt: string;
};

/**
 * Whether the plan lets this account make another practice (D54, D72,
 * D143): the free plan's minutes a week, the paid plans' minutes a month.
 * Checked by every step that calls a paid API before a practice exists
 * (splitting, translating, writing text) and when it's saved, so an
 * account past its limit can't run up costs; a saved practice's notes
 * and audio are still made.
 */
export async function creationAllowed(creator: {
  user: SignedInUser;
}): Promise<PlanCheck> {
  return (await creationAllowance(creator)).check;
}

/** The check, with the week's allowance when the plan has one (D143). */
export async function creationAllowance({
  user,
}: {
  user: SignedInUser;
}): Promise<{
  check: PlanCheck;
  week: WeekAllowance | null;
  /** The plan table with this account's own changes (D161), for `can`. */
  plans: Readonly<Record<PlanId, PlanLimits>>;
  /** What was made this month and week (seconds), for the quota page. */
  made: { count: number; seconds: number; weekSeconds: number };
  /** Referral bonus seconds left (D177); null without any grant. */
  bonusLeftSeconds: number | null;
}> {
  const plan = planFor(user);
  const supabase =
    needsCount(plan, "create-practice") ||
    (user.classroomSeats ?? null) !== null
      ? await getServerSupabase()
      : null;
  const now = new Date();
  const { monthStart } = usagePeriodStarts(now);
  const week = usageWeek(now);
  // Referral bonus minutes (D177), on the free and paid plans.
  const grants =
    plan === "admin" || !supabase
      ? []
      : (await getReferralGrants(user.id)).filter(
          (g) => Date.parse(g.expiresAt) > now.getTime(),
        );
  // The pool needs what was made since the period of its oldest grant.
  const bonusFrom = grants.reduce<string | null>((from, g) => {
    const start = usageWeek(new Date(g.grantedAt)).start;
    const month = usagePeriodStarts(new Date(g.grantedAt)).monthStart;
    const earliest = start < month ? start : month;
    return from === null || earliest < from ? earliest : from;
  }, null);
  const made = supabase
    ? await createdSince(supabase, user.id, monthStart, week.start, bonusFrom)
    : { count: 0, seconds: 0, weekSeconds: 0, rows: [] };
  // A teacher's class plan brings its own monthly minutes (D103), when
  // more than their own plan's.
  const classMinutesMonthly = classMinutes(
    isClassSeats(user.classroomSeats) ? user.classroomSeats : null,
  );
  const classMonthly =
    classMinutesMonthly === null
      ? null
      : classMinutesMonthly * WORDS_PER_MINUTE;
  const own = PLANS[plan];
  const classPlans =
    classMonthly !== null &&
    (own.wordsPerMonth === null ||
      own.wordsPerWeek !== null ||
      own.practicesTotal !== null ||
      own.wordsPerMonth < classMonthly) &&
    plan !== "admin"
      ? {
          ...PLANS,
          [plan]: {
            ...own,
            practicesTotal: null,
            wordsPerWeek: null,
            wordsPerMonth: classMonthly,
            maxPracticeSeconds: Math.max(own.maxPracticeSeconds ?? 0, 300),
          },
        }
      : PLANS;
  // An admin's changes for this account (D161) on top, then the
  // referral bonus (D177) on the week's or the month's minutes.
  const adjusted = await plansFor(user, classPlans);
  const limit = bonusLimit(adjusted[plan]);
  const bonus =
    grants.length > 0 && limit !== null
      ? bonusPool({
          grants,
          creations: made.rows,
          baseSeconds: wordsToSeconds(adjusted[plan][limit]!),
          periodOf: (iso) =>
            limit === "wordsPerWeek"
              ? usageWeek(new Date(iso)).start
              : usagePeriodStarts(new Date(iso)).monthStart,
          now,
        })
      : null;
  const plans = bonus
    ? {
        ...adjusted,
        [plan]: withBonus(adjusted[plan], bonus.extraSeconds),
      }
    : adjusted;
  const limits = plans[plan];
  const check = can(
    plan,
    {
      kind: "create-practice",
      createdThisMonth: made.count,
      secondsThisMonth: made.seconds,
      secondsThisWeek: made.weekSeconds,
      createdTotal: user.practicesCreated,
    },
    plans,
  );
  const left = weekSecondsLeft(limits, made.weekSeconds);
  return {
    check,
    plans,
    made: {
      count: made.count,
      seconds: made.seconds,
      weekSeconds: made.weekSeconds,
    },
    bonusLeftSeconds: bonus ? Math.round(bonus.leftSeconds) : null,
    week:
      left === null || limits.wordsPerWeek === null
        ? null
        : {
            usedSeconds: Math.round(made.weekSeconds),
            leftSeconds: left,
            words: limits.wordsPerWeek,
            resetsAt: week.end,
          },
  };
}

/** A practice from before lengths were kept counts as this long (D102). */
export const UNKNOWN_PRACTICE_SECONDS = 60;

/**
 * The user's practices created since the start of this month (Taiwan
 * time): how many and their estimated seconds (D102), and the seconds of
 * those since the week began (D143; a week can start in last month).
 * Read from practice_creations, kept when a practice is deleted, so
 * deleting doesn't give minutes back. `bonusFrom` reads further back for
 * the referral bonus pool (D177), whose rows come back too.
 */
async function createdSince(
  supabase: NonNullable<Awaited<ReturnType<typeof getServerSupabase>>>,
  userId: string,
  monthStart: string,
  weekStart: string,
  bonusFrom: string | null = null,
): Promise<{
  count: number;
  seconds: number;
  weekSeconds: number;
  rows: CreationRecord[];
}> {
  const from = [weekStart, monthStart, bonusFrom ?? monthStart].reduce(
    (a, b) => (Date.parse(b) < Date.parse(a) ? b : a),
  );
  const { data } = await supabase
    .from("practice_creations")
    .select("seconds, created_at")
    .eq("user_id", userId)
    .gte("created_at", from);
  const rows = data ?? [];
  const length = (row: { seconds: number }) => row.seconds;
  const since = (start: string) => (row: { created_at: string }) =>
    Date.parse(row.created_at) >= Date.parse(start);
  const inMonth = rows.filter(since(monthStart));
  return {
    count: inMonth.length,
    seconds: inMonth.reduce((sum, row) => sum + length(row), 0),
    weekSeconds: rows
      .filter(since(weekStart))
      .reduce((sum, row) => sum + length(row), 0),
    rows: rows.map((row) => ({
      seconds: row.seconds,
      createdAt: row.created_at,
    })),
  };
}
