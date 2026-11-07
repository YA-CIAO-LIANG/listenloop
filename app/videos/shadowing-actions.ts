"use server";

import { getAdminSupabase } from "@/auth/admin";
import { getSignedInUser } from "@/auth/session";
import { cleanTroubleReport } from "@/lib/shadowing-trouble";

/**
 * Records a sentence shadowing kept failing on (D52), for the admin's
 * "Hard sentences" list. Anyone practicing can report, signed in or not;
 * the report holds coverage and recognized text, never audio. Best
 * effort: a failure here never interrupts practice.
 */
export async function reportShadowingTrouble(
  raw: unknown,
): Promise<{ ok: boolean }> {
  const report = cleanTroubleReport(raw);
  const admin = getAdminSupabase();
  if (!report || !admin) return { ok: false };
  const user = await getSignedInUser();
  const { error } = await admin.from("shadowing_issues").insert({
    user_id: user?.id ?? null,
    video_id: report.videoId,
    material_version: report.materialVersion,
    sentence_index: report.sentenceIndex,
    coverages: report.attempts.map((a) => a.coverage),
    heard: report.attempts.map((a) => a.heard),
    browser: report.browser,
    skipped: report.skipped,
  });
  return { ok: !error };
}
