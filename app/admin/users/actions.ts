"use server";

import { revalidatePath } from "next/cache";
import { getAdminSupabase } from "@/auth/admin";
import { logAudit } from "@/auth/audit";
import { getRecentAdmin } from "@/auth/recent-auth";
import { isAccountStatus, isRole } from "@/lib/accounts";
import { isAdminEmail } from "@/lib/admin";
import { isUuid } from "@/lib/custom-practice/organize";
import { CLASS_TIERS } from "@/lib/classroom";
import { isAccountPlan } from "@/lib/plans";

export type UserChangeResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "unavailable"
        | "invalid"
        | "not-found"
        | "self"
        | "listed"
        | "failed"
        /** Signed in too long ago for this (D159). */
        | "reauth";
    };

/** A Supabase Auth ban long enough to mean "until restored" (D50). */
const BAN_FOREVER = "876000h";

type Change = { role: unknown } | { status: unknown } | { plan: unknown };

/**
 * Changes another account's role, status, or plan (D72; set by hand
 * until payments exist) from the admin dashboard (D50, D56), and records
 * it in the audit log. An admin can't change
 * their own account (no locking yourself out), and accounts in
 * ADMIN_EMAILS stay admins (they'd be made admins again at sign-in).
 * Disabling also bans the account in Supabase Auth, so it can't sign in
 * or refresh its session; restoring lifts the ban.
 */
export async function changeUser(
  userId: unknown,
  change: Change,
): Promise<UserChangeResult> {
  // Risky: a sign-in within 30 minutes (D159).
  const [actor, admin] = [await getRecentAdmin(), getAdminSupabase()];
  if (actor === "reauth") return { ok: false, reason: "reauth" };
  if (!actor || !admin) return { ok: false, reason: "unavailable" };
  if (!isUuid(userId)) return { ok: false, reason: "invalid" };
  const field =
    "role" in change ? "role" : "status" in change ? "status" : "plan";
  const value =
    "role" in change
      ? change.role
      : "status" in change
        ? change.status
        : change.plan;
  const valid =
    field === "role"
      ? isRole(value)
      : field === "status"
        ? isAccountStatus(value)
        : isAccountPlan(value);
  if (!valid) return { ok: false, reason: "invalid" };
  if (userId === actor.id) return { ok: false, reason: "self" };

  const { data: profile } = await admin
    .from("profiles")
    .select("number, role, status, plan")
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
    .update({ [field]: value as string } as Record<typeof field, string>)
    .eq("user_id", userId);
  if (error) return { ok: false, reason: "failed" };

  await logAudit(
    actor.id,
    `user.${field}`,
    { type: "user", id: `user-${profile.number}` },
    { from: profile[field], to: value },
  );
  revalidatePath("/admin/users", "layout");
  return { ok: true };
}

/**
 * Turns a teacher's class plan on (a tier's seats, CLASS_TIERS, D173) or off
 * (null) by hand, for trying Classroom before payments open (D103, D105);
 * audited.
 */
export async function setClassroomSeats(
  userId: unknown,
  seats: unknown,
): Promise<UserChangeResult> {
  // Risky: a sign-in within 30 minutes (D159).
  const [actor, admin] = [await getRecentAdmin(), getAdminSupabase()];
  if (actor === "reauth") return { ok: false, reason: "reauth" };
  if (!actor || !admin) return { ok: false, reason: "unavailable" };
  const tierSeats =
    seats === null
      ? null
      : (CLASS_TIERS.find((tier) => tier.seats === seats)?.seats ?? undefined);
  if (!isUuid(userId) || tierSeats === undefined) {
    return { ok: false, reason: "invalid" };
  }
  const { data: profile } = await admin
    .from("profiles")
    .select("number, classroom_seats")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile) return { ok: false, reason: "not-found" };
  const { error } = await admin
    .from("profiles")
    .update({ classroom_seats: tierSeats })
    .eq("user_id", userId);
  if (error) return { ok: false, reason: "failed" };
  await logAudit(
    actor.id,
    "user.classroom",
    { type: "user", id: `user-${profile.number}` },
    { from: profile.classroom_seats, to: tierSeats },
  );
  revalidatePath("/admin/users", "layout");
  return { ok: true };
}
