import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabase } from "@/auth/server";
import { admitAfterSignIn } from "@/auth/beta";
import { logEvent } from "@/auth/events";
import { safeNextPath, withSignInResult } from "@/lib/auth/redirect";

/**
 * Where Google sign-in returns (through Supabase): swaps the one-time code
 * for a session (cookies), then goes back to the page the learner started
 * from. A cancelled or failed sign-in returns there with ?signin=… so the
 * page can say what happened.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const back = (path: string) => NextResponse.redirect(new URL(path, origin));

  const error = searchParams.get("error");
  if (error) {
    return back(
      withSignInResult(
        next,
        error === "access_denied" ? "cancelled" : "failed",
      ),
    );
  }

  const code = searchParams.get("code");
  const supabase = await getServerSupabase();
  if (!code || !supabase) return back(withSignInResult(next, "failed"));

  const { data: session, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    // A disabled account is banned in Supabase Auth (D50).
    const banned = /banned/i.test(exchangeError.message);
    return back(withSignInResult(next, banned ? "disabled" : "failed"));
  }
  if (session.user) {
    // A new account is let in or not (D132).
    const gate = await admitAfterSignIn(session.user);
    if (gate !== "ok") return back(`/beta?reason=${gate}`);
    await logEvent(session.user.id, { type: "sign_in" });
  }
  return back(next);
}
