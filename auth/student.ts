import { getAdminSupabase } from "@/auth/admin";
import { isStudentEmail } from "@/lib/student";

/**
 * Right after a sign-in (D144): a school email verifies the account as a
 * student for a year from now (a new sign-in renews it). The address
 * comes from the sign-in provider, never from the browser. Best effort:
 * a database problem only leaves the account unverified.
 */
export async function verifyStudentOnSignIn(user: {
  id: string;
  email?: string | null;
}): Promise<boolean> {
  if (!isStudentEmail(user.email)) return false;
  const admin = getAdminSupabase();
  if (!admin) return false;
  const { error } = await admin
    .from("profiles")
    .update({ student_verified_at: new Date().toISOString() })
    .eq("user_id", user.id);
  return !error;
}
