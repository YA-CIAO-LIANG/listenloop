"use server";

import { revalidatePath } from "next/cache";
import { getAdminSupabase } from "@/auth/admin";
import { logAudit } from "@/auth/audit";
import { getRecentAdmin } from "@/auth/recent-auth";
import { isUuid } from "@/lib/custom-practice/organize";
import {
  isOverridableLimit,
  OVERRIDE_MAX_DAYS,
  OVERRIDE_REASON_MAX,
} from "@/lib/quota";

/**
 * An admin changing one account's quota for a while, or pausing its AI
 * (D161). Risky (it can cost money or lock someone out), so it needs a
 * recent sign-in (D159); every change is audited with its reason.
 */
export type QuotaAdminResult =
  | { ok: true }
  | { ok: false; reason: "unavailable" | "invalid" | "failed" | "reauth" };

async function asRecentAdmin() {
  const user = await getRecentAdmin();
  const admin = getAdminSupabase();
  if (user === "reauth") return "reauth" as const;
  return user && admin ? { user, admin } : null;
}

const cleanReason = (value: unknown) =>
  typeof value === "string" ? value.trim().slice(0, OVERRIDE_REASON_MAX) : "";

export async function addQuotaOverride(
  input: unknown,
): Promise<QuotaAdminResult> {
  const ctx = await asRecentAdmin();
  if (ctx === "reauth") return { ok: false, reason: "reauth" };
  if (!ctx) return { ok: false, reason: "unavailable" };
  const raw = (input ?? {}) as Record<string, unknown>;
  const extra = Number(raw.extra);
  const days = Number(raw.days);
  const reason = cleanReason(raw.reason);
  if (
    !isUuid(raw.userId) ||
    !isOverridableLimit(raw.limit) ||
    !Number.isInteger(extra) ||
    extra === 0 ||
    Math.abs(extra) > 100_000 ||
    !Number.isInteger(days) ||
    days < 1 ||
    days > OVERRIDE_MAX_DAYS ||
    !reason
  ) {
    return { ok: false, reason: "invalid" };
  }
  const expiresAt = new Date(Date.now() + days * 86_400_000).toISOString();
  const { error } = await ctx.admin.from("quota_overrides").insert({
    user_id: raw.userId,
    limit_name: raw.limit,
    extra,
    expires_at: expiresAt,
    reason,
    created_by: ctx.user.id,
  });
  if (error) return { ok: false, reason: "failed" };
  await logAudit(
    ctx.user.id,
    "quota_override",
    { type: "user", id: raw.userId },
    { limit: raw.limit, extra, days, reason },
  );
  revalidatePath("/admin/users");
  return { ok: true };
}

/** Ends a change now (kept for the record, no longer in force). */
export async function endQuotaOverride(id: unknown): Promise<QuotaAdminResult> {
  const ctx = await asRecentAdmin();
  if (ctx === "reauth") return { ok: false, reason: "reauth" };
  if (!ctx) return { ok: false, reason: "unavailable" };
  if (!isUuid(id)) return { ok: false, reason: "invalid" };
  const { data, error } = await ctx.admin
    .from("quota_overrides")
    .update({ expires_at: new Date().toISOString() })
    .eq("id", id)
    .select("user_id")
    .maybeSingle();
  if (error || !data) return { ok: false, reason: "failed" };
  await logAudit(ctx.user.id, "quota_override_end", {
    type: "user",
    id: data.user_id,
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

/** Pauses (with a reason) or resumes an account's AI features. */
export async function setAiSuspended(
  input: unknown,
): Promise<QuotaAdminResult> {
  const ctx = await asRecentAdmin();
  if (ctx === "reauth") return { ok: false, reason: "reauth" };
  if (!ctx) return { ok: false, reason: "unavailable" };
  const raw = (input ?? {}) as Record<string, unknown>;
  const reason = cleanReason(raw.reason);
  if (
    !isUuid(raw.userId) ||
    typeof raw.suspended !== "boolean" ||
    (raw.suspended && !reason)
  ) {
    return { ok: false, reason: "invalid" };
  }
  const { error } = await ctx.admin
    .from("profiles")
    .update(
      raw.suspended
        ? {
            ai_suspended_at: new Date().toISOString(),
            ai_suspended_reason: reason,
          }
        : { ai_suspended_at: null, ai_suspended_reason: null },
    )
    .eq("user_id", raw.userId);
  if (error) return { ok: false, reason: "failed" };
  await logAudit(
    ctx.user.id,
    raw.suspended ? "ai_suspend" : "ai_resume",
    { type: "user", id: raw.userId },
    raw.suspended ? { reason } : {},
  );
  revalidatePath("/admin/users");
  revalidatePath("/admin/abuse");
  return { ok: true };
}
