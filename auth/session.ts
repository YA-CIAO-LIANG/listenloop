import { cache } from "react";
import { isAdminEmail } from "@/lib/admin";
import { signedInAt } from "@/lib/auth/recent";
import type { Role } from "@/lib/accounts";
import { isAccountPlan, type AccountPlan } from "@/lib/plans";
import { getAdminSupabase } from "./admin";
import { getServerSupabase } from "./server";

/** What the UI shows about the signed-in account. */
export type SignedInUser = {
  id: string;
  email: string;
  /** "User 001" on the admin pages (D50); null if the profile is missing. */
  number: number | null;
  role: Role;
  /** The account's plan (D72); admins are unlimited whatever it says. */
  plan: AccountPlan;
  /** Practices this account has ever created (the free trial, D72). */
  practicesCreated: number;
  /** A teacher's class plan: its seats (D103), or null without one. */
  classroomSeats: number | null;
  /** Last sign-in with a school email (D144), or null; good for a year. */
  studentVerifiedAt?: string | null;
  /** When this session signed in (seconds), for risky actions (D159). */
  signedInAt?: number | null;
  /** AI paused for this account (D161, D162): why, or null. */
  aiSuspended?: string | null;
};

/**
 * The signed-in user from the verified session token, or null (signed
 * out, accounts not configured, or the account disabled; D50). getClaims
 * checks the token's signature, unlike getSession, which trusts the
 * cookie as-is. Accounts in ADMIN_EMAILS are made admins here, the first
 * time they're seen after being listed. Once per request (React cache).
 */
export const getSignedInUser = cache(async (): Promise<SignedInUser | null> => {
  const supabase = await getServerSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;
  const id = claims.sub;
  const email = claims.email ?? "";
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "number, role, status, plan, practices_created, classroom_seats, beta_admitted_at, student_verified_at, ai_suspended_at, ai_suspended_reason",
    )
    .eq("user_id", id)
    .maybeSingle();
  if (profile?.status === "disabled") return null;
  const listed = isAdminEmail(email);
  // Not let in yet (D132): a new account between its first sign-in and
  // the check right after it, or one the check couldn't finish. It's
  // treated as signed out; signing in again runs the check again.
  if (
    profile?.beta_admitted_at === null &&
    profile.role !== "admin" &&
    !listed
  ) {
    return null;
  }
  if (listed && profile?.role !== "admin") {
    // Saved for the admin pages; this request is an admin's either way.
    await getAdminSupabase()
      ?.from("profiles")
      .upsert({ user_id: id, role: "admin" }, { onConflict: "user_id" })
      .then(
        () => {},
        () => {},
      );
  }
  const role: Role = profile?.role === "admin" || listed ? "admin" : "user";
  return {
    id,
    email,
    number: profile?.number ?? null,
    role,
    plan: isAccountPlan(profile?.plan) ? profile.plan : "free",
    practicesCreated: profile?.practices_created ?? 0,
    classroomSeats: profile?.classroom_seats ?? null,
    studentVerifiedAt: profile?.student_verified_at ?? null,
    signedInAt: signedInAt(claims),
    aiSuspended: profile?.ai_suspended_at
      ? (profile.ai_suspended_reason ?? "")
      : null,
  };
});
