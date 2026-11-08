import { can, needsCount, planFor, type PlanCheck } from "@/lib/plans";
import { usagePeriodStarts } from "@/lib/usage-report";
import type { SignedInUser } from "./session";
import { getServerSupabase } from "./server";

/**
 * Whether the plan lets this account make another practice (D54, D72):
 * the free plan's one-practice trial, the paid plan's monthly count.
 * Checked by every step that calls a paid API before a practice exists
 * (splitting, translating, writing text) and when it's saved, so an
 * account past its limit can't run up costs; a saved practice's notes
 * and audio are still made.
 */
export async function creationAllowed({
  user,
}: {
  user: SignedInUser;
}): Promise<PlanCheck> {
  const plan = planFor(user);
  const supabase = needsCount(plan, "create-practice")
    ? await getServerSupabase()
    : null;
  const month = supabase
    ? await createdThisMonth(supabase, user.id)
    : { count: 0, seconds: 0 };
  return can(plan, {
    kind: "create-practice",
    createdThisMonth: month.count,
    secondsThisMonth: month.seconds,
    createdTotal: user.practicesCreated,
  });
}

/** A practice from before lengths were kept counts as this long (D102). */
export const UNKNOWN_PRACTICE_SECONDS = 60;

/**
 * The user's practices created since the start of this month (Taiwan
 * time): how many, and their estimated seconds (D102).
 */
async function createdThisMonth(
  supabase: NonNullable<Awaited<ReturnType<typeof getServerSupabase>>>,
  userId: string,
): Promise<{ count: number; seconds: number }> {
  const { monthStart } = usagePeriodStarts(new Date());
  const { data } = await supabase
    .from("practices")
    .select("estimated_seconds")
    .eq("user_id", userId)
    .gte("created_at", monthStart);
  const rows = data ?? [];
  return {
    count: rows.length,
    seconds: rows.reduce(
      (sum, row) => sum + (row.estimated_seconds ?? UNKNOWN_PRACTICE_SECONDS),
      0,
    ),
  };
}
