"use server";

import { audioOnlyFor, removeAudio, removeUploads } from "./account-data";
import { getAdminSupabase } from "./admin";
import { logEvent } from "./events";
import { userNumberLabel } from "@/lib/accounts";
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

  // Audio only this account's practices use goes too (D60); found before
  // the practices are deleted with the account, removed after.
  const audio = await audioOnlyFor(admin, user.id).catch(() => []);
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return { ok: false, reason: "failed" };
  await removeAudio(admin, audio).catch((e: unknown) =>
    console.error(`[account] audio not removed: ${String(e)}`),
  );
  // Their own recordings (D130), all in their folder.
  await removeUploads(admin, user.id).catch((e: unknown) =>
    console.error(`[account] recordings not removed: ${String(e)}`),
  );
  // The account's own events went with it; this one keeps only its number.
  await logEvent(null, {
    type: "account_delete",
    code: `user-${userNumberLabel(user.number)}`,
  });

  // The account is gone; drop this browser's session cookies too.
  const supabase = await getServerSupabase();
  await supabase?.auth.signOut({ scope: "local" }).catch(() => {});
  return { ok: true };
}
