"use server";

import { getAdminSupabase } from "@/auth/admin";
import { getCreator } from "@/auth/creator";
import { isUuid } from "@/lib/custom-practice/organize";

/**
 * Records how long getting one's own practice ready actually took (D142),
 * measured in the browser; the site's estimate is the median of these.
 * Best effort: nothing to report back.
 */
export async function recordGenerationTime(
  practiceId: unknown,
  seconds: unknown,
): Promise<void> {
  if (
    typeof practiceId !== "string" ||
    !isUuid(practiceId) ||
    typeof seconds !== "number" ||
    !(seconds > 0 && seconds <= 3600)
  ) {
    return;
  }
  const creator = await getCreator();
  const admin = getAdminSupabase();
  if (!creator || !admin) return;
  await admin
    .from("practices")
    .update({ generation_seconds: Math.round(seconds * 10) / 10 })
    .eq("id", practiceId)
    .eq("user_id", creator.user.id)
    .is("generation_seconds", null);
}
