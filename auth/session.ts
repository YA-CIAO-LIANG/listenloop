import { cache } from "react";
import { isAdminEmail } from "@/lib/admin";
import type { Role } from "@/lib/accounts";
import { getAdminSupabase } from "./admin";
import { getServerSupabase } from "./server";

/** What the UI shows about the signed-in account. */
export type SignedInUser = {
  id: string;
  email: string;
  /** "User 001" on the admin pages (D50); null if the profile is missing. */
  number: number | null;
  role: Role;
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
    .select("number, role, status")
    .eq("user_id", id)
    .maybeSingle();
  if (profile?.status === "disabled") return null;
  const listed = isAdminEmail(email);
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
  return { id, email, number: profile?.number ?? null, role };
});
