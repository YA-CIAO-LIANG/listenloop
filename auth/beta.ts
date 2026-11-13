import { cookies } from "next/headers";
import { cache } from "react";
import { isAdminEmail } from "@/lib/admin";
import {
  cleanInviteCode,
  DEFAULT_SIGNUP_CAP,
  INVITE_COOKIE,
  isAdmitted,
  type Admission,
} from "@/lib/beta";
import { getAdminSupabase } from "./admin";
import { requestIpHash } from "./rate-limit";
import { featurePaused } from "./site-switches";
import { getServerSupabase } from "./server";

/**
 * Sign-ups in stages (D132), on the server: the settings, how many are
 * in, and letting a new account in (or not) right after its first
 * sign-in. Without the secret key (local development, E2E) there's no
 * gate: everyone is let in, as before.
 */
export type BetaStatus = {
  open: boolean;
  cap: number;
  /** Accounts let in so far, admins not counted. */
  admitted: number;
  /** Public sign-ups can't take anyone now (closed or at the cap). */
  full: boolean;
  /** Paused by an emergency switch (D155): not even with an invite. */
  paused: boolean;
};

export const getBetaStatus = cache(async (): Promise<BetaStatus | null> => {
  const admin = getAdminSupabase();
  if (!admin) return null;
  // New sign-ups paused by an emergency switch (D155): closed to all.
  const paused = (await featurePaused(null, "signup")) !== null;
  const [{ data: settings }, { data: admitted }] = await Promise.all([
    admin.from("signup_settings").select("open, cap").maybeSingle(),
    admin.rpc("beta_admitted_count"),
  ]);
  const open = settings?.open ?? true;
  const cap = settings?.cap ?? DEFAULT_SIGNUP_CAP;
  const count = admitted ?? 0;
  return {
    open,
    cap,
    admitted: count,
    full: paused || !open || count >= cap,
    paused,
  };
});

/** The invite code this browser brought (from /invite/<code>), if any. */
export async function inviteFromCookie(): Promise<string | null> {
  return cleanInviteCode((await cookies()).get(INVITE_COOKIE)?.value);
}

export type GateResult = "ok" | "full" | "closed";

/**
 * Right after a sign-in (Google, LINE, or a confirmed email): an account
 * already in goes on; a new one is let in with this browser's invite,
 * or while public sign-ups are open and under the cap (admit_account,
 * atomic). Otherwise the account just made is deleted and signed out,
 * so nothing of it stays, and the caller shows "the Beta is full". An
 * account that was already in is never deleted.
 */
export async function admitAfterSignIn(user: {
  id: string;
  email?: string | null;
}): Promise<GateResult> {
  const admin = getAdminSupabase();
  if (!admin) return "ok";
  // Sign-ups paused (D155): a new account isn't let in, even with an
  // invite; admins and accounts already in are.
  if (
    !isAdminEmail(user.email ?? "") &&
    (await featurePaused(null, "signup")) !== null
  ) {
    const { data: profile } = await admin
      .from("profiles")
      .select("beta_admitted_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile?.beta_admitted_at) {
      await (await getServerSupabase())?.auth.signOut().catch(() => undefined);
      await admin.auth.admin.deleteUser(user.id).catch(() => undefined);
      return "closed";
    }
    return "ok";
  }
  const invite = await inviteFromCookie();
  const { data, error } = await admin.rpc("admit_account", {
    target: user.id,
    invite_code: invite ?? "",
    as_admin: isAdminEmail(user.email ?? ""),
  });
  // A database problem lets the person in rather than deleting them.
  if (error || typeof data !== "string") return "ok";
  const answer = data as Admission;
  if (isAdmitted(answer)) {
    if (invite) (await cookies()).delete(INVITE_COOKIE);
    // A new account (D162): where it signed up from, hashed, to spot
    // many accounts from one place. Best effort.
    if (answer !== "admitted") {
      try {
        await admin
          .from("account_signals")
          .upsert({ user_id: user.id, ip_hash: await requestIpHash() });
      } catch {
        // Not worth failing a sign-in over.
      }
    }
    return "ok";
  }
  await (await getServerSupabase())?.auth.signOut().catch(() => undefined);
  await admin.auth.admin.deleteUser(user.id).catch(() => undefined);
  return answer === "closed" ? "closed" : "full";
}
