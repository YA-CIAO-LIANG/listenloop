import { NextResponse, type NextRequest } from "next/server";
import { getAdminSupabase } from "@/auth/admin";
import {
  cleanInviteCode,
  INVITE_COOKIE,
  INVITE_COOKIE_SECONDS,
  inviteState,
} from "@/lib/beta";

/**
 * An invite link (D132): /invite/<code>. A usable code is kept in a
 * cookie (30 days) and the person goes to sign in; the invite is used up
 * at their first sign-in, whatever the cap. A code that's wrong, used
 * up, expired, or withdrawn goes to the Beta page, which says so.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { origin } = request.nextUrl;
  const code = cleanInviteCode((await params).code);
  const admin = getAdminSupabase();
  const { data: invite } =
    code && admin
      ? await admin
          .from("beta_invites")
          .select("max_uses, uses, expires_at, revoked_at")
          .eq("code", code)
          .maybeSingle()
      : { data: null };
  if (!code || !invite || inviteState(invite, new Date()) !== "active") {
    return NextResponse.redirect(new URL("/beta?reason=invite", origin));
  }
  const response = NextResponse.redirect(new URL("/login?invited=1", origin));
  response.cookies.set(INVITE_COOKIE, code, {
    httpOnly: true,
    secure: origin.startsWith("https:"),
    sameSite: "lax",
    path: "/",
    maxAge: INVITE_COOKIE_SECONDS,
  });
  return response;
}
