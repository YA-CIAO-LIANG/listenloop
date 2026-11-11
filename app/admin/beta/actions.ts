"use server";

import { revalidatePath } from "next/cache";
import { getAdminSupabase } from "@/auth/admin";
import { logAudit } from "@/auth/audit";
import { getAdminUser } from "@/auth/creator";
import {
  cleanInviteOptions,
  cleanSignupSettings,
  inviteUrl,
  newInviteCode,
} from "@/lib/beta";
import { isUuid } from "@/lib/custom-practice/organize";
import { SITE_URL } from "@/lib/site";

/**
 * The admin's side of sign-ups in stages (D132): the switch and cap,
 * invites, and inviting people from the waiting list. Admins only; every
 * change goes in the audit log.
 */
export type BetaAdminResult =
  { ok: true } | { ok: false; reason: "unavailable" | "invalid" | "failed" };

async function asAdmin() {
  const user = await getAdminUser();
  const admin = getAdminSupabase();
  return user && admin ? { user, admin } : null;
}

export async function saveSignupSettings(
  input: unknown,
): Promise<BetaAdminResult> {
  const ctx = await asAdmin();
  if (!ctx) return { ok: false, reason: "unavailable" };
  const raw = (input ?? {}) as Record<string, unknown>;
  const settings = cleanSignupSettings({ open: raw.open, cap: raw.cap });
  if (!settings) return { ok: false, reason: "invalid" };
  const { error } = await ctx.admin
    .from("signup_settings")
    .update({
      ...settings,
      updated_at: new Date().toISOString(),
      updated_by: ctx.user.id,
    })
    .eq("id", true);
  if (error) return { ok: false, reason: "failed" };
  await logAudit(
    ctx.user.id,
    "signup_settings",
    { type: "setting", id: "signup" },
    settings,
  );
  revalidatePath("/admin/beta");
  return { ok: true };
}

export type CreateInviteResult =
  | { ok: true; code: string; url: string }
  | { ok: false; reason: "unavailable" | "invalid" | "failed" };

async function insertInvite(
  ctx: NonNullable<Awaited<ReturnType<typeof asAdmin>>>,
  options: { maxUses: number; days: number | null; note: string },
): Promise<{ id: string; code: string } | null> {
  // A clash with an existing code is retried with a new one.
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = newInviteCode();
    const { data, error } = await ctx.admin
      .from("beta_invites")
      .insert({
        code,
        note: options.note || null,
        max_uses: options.maxUses,
        expires_at:
          options.days === null
            ? null
            : new Date(Date.now() + options.days * 86_400_000).toISOString(),
        created_by: ctx.user.id,
      })
      .select("id, code")
      .single();
    if (data) return data;
    if (error?.code !== "23505") return null;
  }
  return null;
}

/** A new invite: how many people may use it, and for how many days. */
export async function createInvite(
  input: unknown,
): Promise<CreateInviteResult> {
  const ctx = await asAdmin();
  if (!ctx) return { ok: false, reason: "unavailable" };
  const raw = (input ?? {}) as Record<string, unknown>;
  const options = cleanInviteOptions({
    maxUses: raw.maxUses,
    days: raw.days,
    note: raw.note,
  });
  if (!options) return { ok: false, reason: "invalid" };
  const invite = await insertInvite(ctx, options);
  if (!invite) return { ok: false, reason: "failed" };
  await logAudit(
    ctx.user.id,
    "invite_create",
    { type: "setting", id: `invite:${invite.code}` },
    { maxUses: options.maxUses, days: options.days },
  );
  revalidatePath("/admin/beta");
  return { ok: true, code: invite.code, url: inviteUrl(SITE_URL, invite.code) };
}

/** Withdraws an invite: its link stops working; who used it stays in. */
export async function revokeInvite(id: unknown): Promise<BetaAdminResult> {
  const ctx = await asAdmin();
  if (!ctx) return { ok: false, reason: "unavailable" };
  if (!isUuid(id)) return { ok: false, reason: "invalid" };
  const { data, error } = await ctx.admin
    .from("beta_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .is("revoked_at", null)
    .select("code");
  if (error || !data?.length) return { ok: false, reason: "failed" };
  await logAudit(ctx.user.id, "invite_revoke", {
    type: "setting",
    id: `invite:${data[0].code}`,
  });
  revalidatePath("/admin/beta");
  return { ok: true };
}

export type InviteWaitlistResult =
  | { ok: true; invites: { email: string; url: string }[] }
  | { ok: false; reason: "unavailable" | "invalid" | "failed" };

/** Waiting-list invites last this long: a month to sign up. */
const WAITLIST_INVITE_DAYS = 30;

/**
 * Invites people from the waiting list, a batch at a time: each gets
 * their own single-use link (30 days), shown here for the admin to send
 * by hand until an email service is set up. They're marked as invited.
 */
export async function inviteFromWaitlist(
  ids: unknown,
): Promise<InviteWaitlistResult> {
  const ctx = await asAdmin();
  if (!ctx) return { ok: false, reason: "unavailable" };
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    ids.length > 100 ||
    !ids.every(isUuid)
  ) {
    return { ok: false, reason: "invalid" };
  }
  const { data: people, error } = await ctx.admin
    .from("beta_waitlist")
    .select("id, email")
    .in("id", ids);
  if (error || !people) return { ok: false, reason: "failed" };
  const invites: { email: string; url: string }[] = [];
  for (const person of people) {
    const invite = await insertInvite(ctx, {
      maxUses: 1,
      days: WAITLIST_INVITE_DAYS,
      note: person.email.slice(0, 200),
    });
    if (!invite) return { ok: false, reason: "failed" };
    await ctx.admin
      .from("beta_waitlist")
      .update({ invited_at: new Date().toISOString(), invite_id: invite.id })
      .eq("id", person.id);
    invites.push({
      email: person.email,
      url: inviteUrl(SITE_URL, invite.code),
    });
  }
  await logAudit(
    ctx.user.id,
    "waitlist_invite",
    { type: "setting", id: "waitlist" },
    { count: invites.length },
  );
  revalidatePath("/admin/beta");
  return { ok: true, invites };
}
