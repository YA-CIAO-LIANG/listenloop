import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getAdminSupabase } from "@/auth/admin";
import { logEvent } from "@/auth/events";
import { LINE_COOKIE, lineConfig, lineIdentity } from "@/auth/line";
import { getServerSupabase } from "@/auth/server";
import { safeNextPath, withSignInResult } from "@/lib/auth/redirect";

/**
 * Where LINE Login returns (D101). Checks the state, has LINE verify the
 * id_token, then signs into the account with that email: an existing one
 * (from Google or email) or a new one, so one person has one account.
 * The LINE user id is kept on the account to recognize it. A LINE account
 * without an email can't sign in (the page says to use another way).
 */
export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const jar = await cookies();
  let saved: { state?: string; nonce?: string; next?: string } = {};
  try {
    saved = JSON.parse(jar.get(LINE_COOKIE)?.value ?? "{}");
  } catch {
    saved = {};
  }
  jar.delete({ name: LINE_COOKIE, path: "/auth/line" });
  const next = safeNextPath(saved.next);
  const back = (path: string) => NextResponse.redirect(new URL(path, origin));
  if (searchParams.get("error"))
    return back(withSignInResult(next, "cancelled"));

  const config = lineConfig();
  const admin = getAdminSupabase();
  const supabase = await getServerSupabase();
  const code = searchParams.get("code");
  if (
    !config ||
    !admin ||
    !supabase ||
    !code ||
    !saved.state ||
    !saved.nonce ||
    searchParams.get("state") !== saved.state
  ) {
    return back(withSignInResult(next, "failed"));
  }
  const identity = await lineIdentity(
    code,
    `${origin}/auth/line/callback`,
    saved.nonce,
    config,
  );
  if (!identity) return back(withSignInResult(next, "failed"));
  if (!identity.email) return back(withSignInResult(next, "noEmail"));

  // A one-time sign-in link for that email, used right here: it signs
  // into the existing account, or makes one (LINE confirmed the email).
  const { data: link, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: identity.email,
  });
  const tokenHash = link?.properties?.hashed_token;
  if (error || !tokenHash) return back(withSignInResult(next, "failed"));
  const { data: session, error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink",
  });
  if (verifyError || !session.user) {
    const banned = /banned/i.test(verifyError?.message ?? "");
    return back(withSignInResult(next, banned ? "disabled" : "failed"));
  }
  await admin.auth.admin.updateUserById(session.user.id, {
    app_metadata: { ...session.user.app_metadata, line_sub: identity.sub },
  });
  await logEvent(session.user.id, { type: "sign_in" });
  return back(next);
}
