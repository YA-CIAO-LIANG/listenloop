"use server";

import { cookies } from "next/headers";
import { getAdminSupabase } from "@/auth/admin";
import { allowAction } from "@/auth/rate-limit";
import { getSignedInUser } from "@/auth/session";
import { VISITOR_COOKIE } from "@/lib/intent";
import {
  cleanPriceAnswers,
  PRICE_SURVEY_CONTEXTS,
  type PriceSurveyContext,
} from "@/lib/price-survey";

export type PriceSurveyResult =
  { ok: true } | { ok: false; reason: "invalid" | "unavailable" | "failed" };

/**
 * Saves one Van Westendorp answer (D174): the account's, or the
 * browser's when signed out. Answering again keeps the first answer.
 */
export async function submitPriceSurvey(
  input: unknown,
): Promise<PriceSurveyResult> {
  const raw = (input ?? {}) as Record<string, unknown>;
  const answers = cleanPriceAnswers(raw.answers);
  const context = (PRICE_SURVEY_CONTEXTS as readonly unknown[]).includes(
    raw.context,
  )
    ? (raw.context as PriceSurveyContext)
    : null;
  if (!answers || !context) return { ok: false, reason: "invalid" };
  const admin = getAdminSupabase();
  if (!admin) return { ok: false, reason: "unavailable" };
  const user = await getSignedInUser();
  const visitor = (await cookies()).get(VISITOR_COOKIE)?.value;
  const visitorId =
    visitor && /^[a-f0-9-]{8,64}$/.test(visitor) ? visitor : null;
  if (!user && !visitorId) return { ok: false, reason: "unavailable" };
  if (!(await allowAction("intent", user?.id ?? null))) {
    return { ok: false, reason: "failed" };
  }
  const { error } = await admin.from("price_survey_responses").insert({
    user_id: user?.id ?? null,
    visitor_id: user ? null : visitorId,
    context,
    too_cheap: answers.tooCheap,
    bargain: answers.bargain,
    expensive: answers.expensive,
    too_expensive: answers.tooExpensive,
  });
  // Already answered (unique index): the first answer stands.
  if (error && error.code !== "23505") return { ok: false, reason: "failed" };
  return { ok: true };
}
