"use server";

import { revalidatePath } from "next/cache";
import { getAdminSupabase } from "@/auth/admin";
import { logAudit } from "@/auth/audit";
import { getAdminUser } from "@/auth/creator";
import { isAccountStatus, isRole } from "@/lib/accounts";
import { isAdminEmail } from "@/lib/admin";
import { isUuid } from "@/lib/custom-practice/organize";

export type UserChangeResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        "unavailable" | "invalid" | "not-found" | "self" | "listed" | "failed";
    };

/** A Supabase Auth ban long enough to mean "until restored" (D50). */
const BAN_FOREVER = "876000h";

type Change = { role: unknown } | { status: unknown };

/**
 * Changes another account's role or status from the admin dashboard
 * (D50, D56), and records it in the audit log. An admin can't change
 * their own account (no locking yourself out), and accounts in
 * ADMIN_EMAILS stay admins (they'd be made admins again at sign-in).
 * Disabling also bans the account in Supabase Auth, so it can't sign in
 * or refresh its session; restoring lifts the ban.
 */
export async function changeUser(
  userId: unknown,
  change: Change,
): Promise<UserChangeResult> {
  const [actor, admin] = [await getAdminUser(), getAdminSupabase()];
  if (!actor || !admin) return { ok: false, reason: "unavailable" };
  if (!isUuid(userId)) return { ok: false, reason: "invalid" };
  const field = "role" in change ? "role" : "status";
  const value = "role" in change ? change.role : change.status;
  if (field === "role" ? !isRole(value) : !isAccountStatus(value)) {
    return { ok: false, reason: "invalid" };
  }
  if (userId === actor.id) return { ok: false, reason: "self" };

  const { data: profile } = await admin
    .from("profiles")
    .select("number, role, status")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile) return { ok: false, reason: "not-found" };
  const demoting =
    (field === "role" && value === "user") ||
    (field === "status" && value === "disabled");
  if (demoting) {
    const { data } = await admin.auth.admin.getUserById(userId);
    if (isAdminEmail(data.user?.email)) return { ok: false, reason: "listed" };
  }

  if (field === "status") {
    const { error } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: value === "disabled" ? BAN_FOREVER : "none",
    });
    if (error) return { ok: false, reason: "failed" };
  }
  const { error } = await admin
    .from("profiles")
    .update(
      field === "role"
        ? { role: value as string }
        : { status: value as string },
    )
    .eq("user_id", userId);
  if (error) return { ok: false, reason: "failed" };

  await logAudit(
    actor.id,
    field === "role" ? "user.role" : "user.status",
    { type: "user", id: `user-${profile.number}` },
    { from: profile[field], to: value },
  );
  revalidatePath("/admin/users", "layout");
  return { ok: true };
}
