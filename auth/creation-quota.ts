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
  const createdThisMonth = supabase
    ? await countCreatedThisMonth(supabase, user.id)
    : 0;
  return can(plan, {
    kind: "create-practice",
    createdThisMonth,
    createdTotal: user.practicesCreated,
  });
}

/** The user's practices created since the start of this month (Taiwan time). */
async function countCreatedThisMonth(
  supabase: NonNullable<Awaited<ReturnType<typeof getServerSupabase>>>,
  userId: string,
): Promise<number> {
  const { monthStart } = usagePeriodStarts(new Date());
  const { count } = await supabase
    .from("practices")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", monthStart);
  return count ?? 0;
}
