import { NextResponse, type NextRequest } from "next/server";
import { referrerOf } from "@/auth/referral";
import {
  cleanReferralCode,
  REFERRAL_COOKIE,
  REFERRAL_COOKIE_SECONDS,
} from "@/lib/referral";

/**
 * A friend's referral link (D177): /r/<code>. A code that belongs to an
 * account is kept in a cookie (30 days) until the first sign-in, and the
 * person goes to sign in. Unlike a Beta invite it doesn't skip the
 * sign-up cap. A wrong code just goes to the home page.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { origin } = request.nextUrl;
  const code = cleanReferralCode((await params).code);
  if (!code || !(await referrerOf(code))) {
    return NextResponse.redirect(new URL("/", origin));
  }
  const response = NextResponse.redirect(new URL("/login?referred=1", origin));
  response.cookies.set(REFERRAL_COOKIE, code, {
    httpOnly: true,
    secure: origin.startsWith("https:"),
    sameSite: "lax",
    path: "/",
    maxAge: REFERRAL_COOKIE_SECONDS,
  });
  return response;
}
