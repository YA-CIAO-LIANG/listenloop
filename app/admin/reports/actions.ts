"use server";

import { revalidatePath } from "next/cache";
import { getAdminSupabase } from "@/auth/admin";
import type { WriteResult } from "@/auth/admin-writes";
import { getAdminUser } from "@/auth/creator";
import { isUuid } from "@/lib/custom-practice/organize";
import { isReportReason } from "@/lib/moderation";

/**
 * Reviewing reports (D31). Admins only; the writes use the secret key,
 * because taking down someone else's practice is exactly what row level
 * security keeps users from doing (and the removal columns are guarded by
 * a trigger that only lets the server change them).
 */
export type ModerationResult = WriteResult;

type Admin = NonNullable<ReturnType<typeof getAdminSupabase>>;

async function asModerator(
  write: (admin: Admin, now: string) => Promise<ModerationResult>,
): Promise<ModerationResult> {
  const [user, admin] = [await getAdminUser(), getAdminSupabase()];
  if (!user || !admin) return { ok: false, reason: "unavailable" };
  const result = await write(admin, new Date().toISOString()).catch(
    (): ModerationResult => ({ ok: false, reason: "failed" }),
  );
  if (result.ok) {
    revalidatePath("/admin/reports");
    revalidatePath("/explore");
  }
  return result;
}

/** Takes a practice down for `reason` and closes its open reports. */
export async function removePractice(
  practiceId: unknown,
  reason: unknown,
): Promise<ModerationResult> {
  if (!isUuid(practiceId) || !isReportReason(reason)) {
    return { ok: false, reason: "invalid" };
  }
  return asModerator(async (admin, now) => {
    const { data, error } = await admin
      .from("practices")
      .update({ removed_at: now, removed_reason: reason })
      .eq("id", practiceId)
      .select("id");
    if (error) return { ok: false, reason: "failed" };
    if (!data.length) return { ok: false, reason: "not-found" };
    const { error: reportsError } = await admin
      .from("practice_reports")
      .update({ status: "removed", resolved_at: now })
      .eq("practice_id", practiceId)
      .eq("status", "open");
    return reportsError ? { ok: false, reason: "failed" } : { ok: true };
  });
}

/** Closes a practice's open reports without taking it down. */
export async function dismissReports(
  practiceId: unknown,
): Promise<ModerationResult> {
  if (!isUuid(practiceId)) return { ok: false, reason: "invalid" };
  return asModerator(async (admin, now) => {
    const { data, error } = await admin
      .from("practice_reports")
      .update({ status: "dismissed", resolved_at: now })
      .eq("practice_id", practiceId)
      .eq("status", "open")
      .select("id");
    if (error) return { ok: false, reason: "failed" };
    return data.length ? { ok: true } : { ok: false, reason: "not-found" };
  });
}

/** Undoes a takedown: public again if its author still has it public. */
export async function restorePractice(
  practiceId: unknown,
): Promise<ModerationResult> {
  if (!isUuid(practiceId)) return { ok: false, reason: "invalid" };
  return asModerator(async (admin) => {
    const { data, error } = await admin
      .from("practices")
      .update({ removed_at: null, removed_reason: null })
      .eq("id", practiceId)
      .not("removed_at", "is", null)
      .select("id");
    if (error) return { ok: false, reason: "failed" };
    return data.length ? { ok: true } : { ok: false, reason: "not-found" };
  });
}
