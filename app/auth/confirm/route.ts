import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { logEvent } from "@/auth/events";
import { getServerSupabase } from "@/auth/server";
import { safeNextPath, withSignInResult } from "@/lib/auth/redirect";

const TYPES: readonly EmailOtpType[] = [
  "signup",
  "recovery",
  "email",
  "magiclink",
];

/**
 * Where an email link lands (D101): confirming a new address, or a
 * password reset. Verifies the one-time token (which signs the person in,
 * cookies), then goes on to `next` (the reset form for a reset).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const back = (path: string) => NextResponse.redirect(new URL(path, origin));
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const supabase = await getServerSupabase();
  if (!tokenHash || !type || !TYPES.includes(type) || !supabase) {
    return back(withSignInResult(next, "failed"));
  }
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });
  if (error) return back(withSignInResult(next, "failed"));
  if (data.user && type !== "recovery") {
    await logEvent(data.user.id, { type: "sign_in" });
  }
  return back(next);
}
