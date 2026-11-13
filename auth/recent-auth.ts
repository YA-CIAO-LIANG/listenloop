import { signedInRecently } from "@/lib/auth/recent";
import { getAdminUser } from "./creator";
import type { SignedInUser } from "./session";

/**
 * An admin who signed in within the last 30 minutes (D159), for risky
 * actions. "reauth": an admin, but signed in too long ago; they're asked
 * to sign out and in again. null: not an admin.
 */
export async function getRecentAdmin(): Promise<
  SignedInUser | "reauth" | null
> {
  const user = await getAdminUser();
  if (!user) return null;
  return signedInRecently(user.signedInAt) ? user : "reauth";
}
