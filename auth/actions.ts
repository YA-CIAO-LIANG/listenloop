"use server";

import { getAdminSupabase } from "./admin";
import { getServerSupabase } from "./server";
import { getSignedInUser } from "./session";

export type DeleteAccountResult =
  { ok: true } | { ok: false; reason: "signed-out" | "failed" };

/**
 * Deletes the signed-in account for good: the auth user, and with it
 * (on delete cascade) every row of progress and documents. Who is deleted
 * comes from the verified session only, never from the request, so one
 * user can't delete another. Then clears the session cookies.
 */
export async function deleteAccount(): Promise<DeleteAccountResult> {
  const user = await getSignedInUser();
  if (!user) return { ok: false, reason: "signed-out" };
  const admin = getAdminSupabase();
  if (!admin) return { ok: false, reason: "failed" };

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return { ok: false, reason: "failed" };

  // The account is gone; drop this browser's session cookies too.
  const supabase = await getServerSupabase();
  await supabase?.auth.signOut({ scope: "local" }).catch(() => {});
  return { ok: true };
}
