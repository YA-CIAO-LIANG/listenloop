import { getServerSupabase } from "./server";

/** What the UI shows about the signed-in account. */
export type SignedInUser = { id: string; email: string };

/**
 * The signed-in user from the verified session token, or null (signed
 * out, or accounts not configured). getClaims checks the token's
 * signature, unlike getSession, which trusts the cookie as-is.
 */
export async function getSignedInUser(): Promise<SignedInUser | null> {
  const supabase = await getServerSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;
  return { id: claims.sub, email: claims.email ?? "" };
}
