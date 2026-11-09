"use server";

import { revalidatePath } from "next/cache";
import { getAdminSupabase } from "@/auth/admin";
import { logAudit } from "@/auth/audit";
import { getAdminUser } from "@/auth/creator";
import { allowAction } from "@/auth/rate-limit";
import { getServerSupabase } from "@/auth/server";
import { getSignedInUser } from "@/auth/session";
import { isUuid } from "@/lib/custom-practice/organize";
import {
  parseSentenceReport,
  SENTENCE_REPORT_NOTE_MAX,
  SENTENCE_REPORT_RESOLUTIONS,
  type SentenceReportResolution,
} from "@/lib/sentence-reports";

export type SentenceReportResult =
  | { ok: true }
  | {
      ok: false;
      reason: "signedOut" | "invalid" | "busy" | "failed";
    };

/**
 * A learner reports a problem with one sentence (D113), as themselves
 * (row level security checks it), so they can be told when it's fixed.
 */
export async function reportSentence(
  input: unknown,
): Promise<SentenceReportResult> {
  const report = parseSentenceReport(input);
  if (!report) return { ok: false, reason: "invalid" };
  const [user, supabase] = await Promise.all([
    getSignedInUser(),
    getServerSupabase(),
  ]);
  if (!user || !supabase) return { ok: false, reason: "signedOut" };
  if (!(await allowAction("sentenceReport", user.id))) {
    return { ok: false, reason: "busy" };
  }
  const { error } = await supabase.from("sentence_reports").insert({
    user_id: user.id,
    video_id: report.videoId,
    material_version: report.version,
    sentence_index: report.index,
    kind: report.kind,
    note: report.note,
  });
  return error ? { ok: false, reason: "failed" } : { ok: true };
}

/** An admin marks reports fixed or not acted on, with a note (audited). */
export async function resolveSentenceReports(
  ids: unknown,
  resolution: unknown,
  note: unknown,
): Promise<{ ok: boolean }> {
  const [actor, admin] = [await getAdminUser(), getAdminSupabase()];
  if (!actor || !admin) return { ok: false };
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    ids.length > 100 ||
    !ids.every(isUuid) ||
    !(SENTENCE_REPORT_RESOLUTIONS as readonly unknown[]).includes(resolution)
  ) {
    return { ok: false };
  }
  const text =
    typeof note === "string"
      ? note.trim().slice(0, SENTENCE_REPORT_NOTE_MAX)
      : "";
  const { error } = await admin
    .from("sentence_reports")
    .update({
      status: resolution as SentenceReportResolution,
      resolution_note: text || null,
      resolved_at: new Date().toISOString(),
    })
    .in("id", ids);
  if (error) return { ok: false };
  for (const id of ids) {
    await logAudit(
      actor.id,
      "sentenceReport.resolve",
      { type: "report", id },
      { to: resolution },
    );
  }
  revalidatePath("/admin/sentences");
  return { ok: true };
}

/** The learner has seen that their reports were fixed: stop telling them. */
export async function dismissFixedReports(
  ids: unknown,
): Promise<{ ok: boolean }> {
  const [user, admin] = [await getSignedInUser(), getAdminSupabase()];
  if (!user || !admin || !Array.isArray(ids) || !ids.every(isUuid)) {
    return { ok: false };
  }
  const { error } = await admin
    .from("sentence_reports")
    .update({ notified_at: new Date().toISOString() })
    .in("id", ids)
    .eq("user_id", user.id)
    .eq("status", "fixed");
  return { ok: !error };
}
