"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getBetaStatus, inviteFromCookie } from "@/auth/beta";
import { logEvent } from "@/auth/events";
import { allowAction } from "@/auth/rate-limit";
import { getServerSupabase } from "@/auth/server";
import { passwordProblem, type PasswordProblem } from "@/lib/auth/password";
import { safeNextPath } from "@/lib/auth/redirect";

/**
 * Email and password accounts (D101), next to Google and LINE. Supabase
 * Auth keeps the passwords (hashed) and sends the emails: a link to
 * confirm the address before the first sign-in, and one to reset a
 * forgotten password. Answers never say whether an address has an
 * account, so the forms can't be used to find out who uses ListenLoop.
 */
export type EmailAuthResult =
  | { ok: true; sent?: true }
  | {
      ok: false;
      reason:
        | "unavailable"
        | "busy"
        | "email"
        | "credentials"
        | "unconfirmed"
        | "disabled"
        | "failed"
        | "short"
        | "long"
        | "common"
        | "emailPassword"
        | "full";
    };

/** A password problem as a reason ("email" is the address field's). */
const passwordReason = (problem: PasswordProblem) =>
  problem === "email" ? "emailPassword" : problem;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

const field = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
};

export async function signUpWithEmail(
  form: FormData,
): Promise<EmailAuthResult> {
  const email = field(form, "email").trim().toLowerCase();
  const password = field(form, "password");
  if (!EMAIL.test(email) || email.length > 254) {
    return { ok: false, reason: "email" };
  }
  const problem = passwordProblem(password, email);
  if (problem) return { ok: false, reason: passwordReason(problem) };
  if (!(await allowAction("auth", null))) return { ok: false, reason: "busy" };
  // The Beta is full and there's no invite (D132): say so before any
  // email goes out. (Someone who already has an account can sign in.)
  const beta = await getBetaStatus();
  if (beta?.paused || (beta?.full && !(await inviteFromCookie()))) {
    return { ok: false, reason: "full" };
  }
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, reason: "unavailable" };
  const next = safeNextPath(field(form, "next"));
  const confirm = new URL("/auth/confirm", await origin());
  confirm.searchParams.set("next", next);
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: confirm.toString() },
  });
  if (error) {
    return {
      ok: false,
      reason: /password/i.test(error.message) ? "short" : "failed",
    };
  }
  // The same answer whether or not the address already had an account.
  return { ok: true, sent: true };
}

export async function signInWithEmail(
  form: FormData,
): Promise<EmailAuthResult> {
  const email = field(form, "email").trim().toLowerCase();
  const password = field(form, "password");
  if (!EMAIL.test(email) || !password) {
    return { ok: false, reason: "credentials" };
  }
  if (!(await allowAction("auth", null))) return { ok: false, reason: "busy" };
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, reason: "unavailable" };
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    const message = error.message.toLowerCase();
    return {
      ok: false,
      reason: message.includes("not confirmed")
        ? "unconfirmed"
        : message.includes("banned")
          ? "disabled"
          : "credentials",
    };
  }
  if (data.user) await logEvent(data.user.id, { type: "sign_in" });
  redirect(safeNextPath(field(form, "next")));
}

export async function requestPasswordReset(
  form: FormData,
): Promise<EmailAuthResult> {
  const email = field(form, "email").trim().toLowerCase();
  if (!EMAIL.test(email)) return { ok: false, reason: "email" };
  if (!(await allowAction("auth", null))) return { ok: false, reason: "busy" };
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, reason: "unavailable" };
  const confirm = new URL("/auth/confirm", await origin());
  confirm.searchParams.set("next", "/login/reset");
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: confirm.toString(),
  });
  // Sent or not, the answer is the same (no account lookup).
  return { ok: true, sent: true };
}

/** Sets a new password, signed in by the reset link (D101). */
export async function setNewPassword(form: FormData): Promise<EmailAuthResult> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, reason: "unavailable" };
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false, reason: "failed" };
  const password = field(form, "password");
  const problem = passwordProblem(password, data.user.email ?? "");
  if (problem) return { ok: false, reason: passwordReason(problem) };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, reason: "failed" };
  return { ok: true };
}
