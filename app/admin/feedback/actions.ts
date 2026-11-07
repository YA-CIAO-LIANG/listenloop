"use server";

import { revalidatePath } from "next/cache";
import { getAdminSupabase } from "@/auth/admin";
import { logAudit } from "@/auth/audit";
import { getAdminUser } from "@/auth/creator";
import { isUuid } from "@/lib/custom-practice/organize";

export type FeedbackStatusResult =
  { ok: true } | { ok: false; reason: "unavailable" | "invalid" | "failed" };

/** Marks feedback done, or open again (D60), recorded in the audit. */
export async function setFeedbackStatus(
  id: unknown,
  status: unknown,
): Promise<FeedbackStatusResult> {
  const [actor, admin] = [await getAdminUser(), getAdminSupabase()];
  if (!actor || !admin) return { ok: false, reason: "unavailable" };
  if (!isUuid(id) || (status !== "open" && status !== "done")) {
    return { ok: false, reason: "invalid" };
  }
  const { error } = await admin
    .from("feedback")
    .update({ status })
    .eq("id", id);
  if (error) return { ok: false, reason: "failed" };
  await logAudit(
    actor.id,
    "feedback.status",
    { type: "setting", id },
    { to: status },
  );
  revalidatePath("/admin/feedback");
  return { ok: true };
}
