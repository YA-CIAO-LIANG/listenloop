"use server";

import { revalidatePath } from "next/cache";
import { getAdminSupabase } from "@/auth/admin";
import { logAudit } from "@/auth/audit";
import { getRecentAdmin } from "@/auth/recent-auth";
import { isUuid } from "@/lib/custom-practice/organize";

/**
 * An admin's decision on an abuse flag (D162): confirm it (AI stays
 * paused; disabling the account is on its user page), or dismiss it
 * (a false alarm: AI resumes if the detector paused it). Needs a recent
 * sign-in (D159); audited with the note.
 */
export type AbuseResult =
  | { ok: true }
  | { ok: false; reason: "unavailable" | "invalid" | "failed" | "reauth" };

export async function resolveAbuseFlag(input: unknown): Promise<AbuseResult> {
  const user = await getRecentAdmin();
  if (user === "reauth") return { ok: false, reason: "reauth" };
  const admin = getAdminSupabase();
  if (!user || !admin) return { ok: false, reason: "unavailable" };
  const raw = (input ?? {}) as Record<string, unknown>;
  const note =
    typeof raw.note === "string" ? raw.note.trim().slice(0, 500) : "";
  if (
    !isUuid(raw.id) ||
    (raw.decision !== "confirmed" && raw.decision !== "dismissed")
  ) {
    return { ok: false, reason: "invalid" };
  }
  const { data: flag, error } = await admin
    .from("abuse_flags")
    .update({
      status: raw.decision,
      note: note || null,
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
    })
    .eq("id", raw.id)
    .eq("status", "open")
    .select("user_id, kind, auto_suspended")
    .maybeSingle();
  if (error || !flag) return { ok: false, reason: "failed" };
  if (raw.decision === "dismissed" && flag.auto_suspended) {
    await admin
      .from("profiles")
      .update({ ai_suspended_at: null, ai_suspended_reason: null })
      .eq("user_id", flag.user_id);
  }
  await logAudit(
    user.id,
    raw.decision === "confirmed" ? "abuse_confirm" : "abuse_dismiss",
    { type: "user", id: flag.user_id },
    { kind: flag.kind, note },
  );
  revalidatePath("/admin/abuse");
  return { ok: true };
}
