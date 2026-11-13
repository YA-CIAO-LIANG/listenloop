"use server";

import { revalidatePath } from "next/cache";
import { getAdminSupabase } from "@/auth/admin";
import { logAudit } from "@/auth/audit";
import { getAdminUser } from "@/auth/creator";
import { clearSiteSwitchCache } from "@/auth/site-switches";
import {
  ANNOUNCEMENT_LEVELS,
  parseSwitches,
  SITE_ANNOUNCEMENT_MAX,
  SWITCHABLE_FEATURES,
  type AnnouncementLevel,
} from "@/lib/site-switches";

/**
 * The admin's emergency switches and site announcements (D155). Admins
 * only; every change goes in the audit log.
 */
export type OpsResult =
  { ok: true } | { ok: false; reason: "unavailable" | "invalid" | "failed" };

async function asAdmin() {
  const user = await getAdminUser();
  const admin = getAdminSupabase();
  return user && admin ? { user, admin } : null;
}

function refresh() {
  clearSiteSwitchCache();
  revalidatePath("/admin/ops");
  revalidatePath("/status");
}

/** Saves all the switches at once (the form sends every one). */
export async function saveSiteSwitches(input: unknown): Promise<OpsResult> {
  const ctx = await asAdmin();
  if (!ctx) return { ok: false, reason: "unavailable" };
  const raw = (input ?? {}) as Record<string, unknown>;
  const features = (raw.features ?? {}) as Record<string, unknown>;
  if (
    typeof raw.maintenance !== "boolean" ||
    typeof raw.readOnly !== "boolean" ||
    !SWITCHABLE_FEATURES.every((f) => typeof features[f] === "boolean")
  ) {
    return { ok: false, reason: "invalid" };
  }
  const next = parseSwitches({
    maintenance: raw.maintenance,
    read_only: raw.readOnly,
    features,
  });
  const { error } = await ctx.admin
    .from("site_settings")
    .update({
      maintenance: next.maintenance,
      read_only: next.readOnly,
      features: next.features,
      updated_at: new Date().toISOString(),
      updated_by: ctx.user.id,
    })
    .eq("id", true);
  if (error) return { ok: false, reason: "failed" };
  await logAudit(
    ctx.user.id,
    "site_switches",
    { type: "setting", id: "site" },
    next,
  );
  refresh();
  return { ok: true };
}

/** Posts an announcement, shown at once, until `hours` from now (or until ended). */
export async function postSiteAnnouncement(input: unknown): Promise<OpsResult> {
  const ctx = await asAdmin();
  if (!ctx) return { ok: false, reason: "unavailable" };
  const raw = (input ?? {}) as Record<string, unknown>;
  const level = ANNOUNCEMENT_LEVELS.find((l) => l === raw.level) as
    AnnouncementLevel | undefined;
  const bodyZh = typeof raw.bodyZh === "string" ? raw.bodyZh.trim() : "";
  const bodyEn = typeof raw.bodyEn === "string" ? raw.bodyEn.trim() : "";
  const hours = raw.hours === null ? null : Number(raw.hours);
  if (
    !level ||
    !bodyZh ||
    !bodyEn ||
    bodyZh.length > SITE_ANNOUNCEMENT_MAX ||
    bodyEn.length > SITE_ANNOUNCEMENT_MAX ||
    (hours !== null && !(Number.isInteger(hours) && hours >= 1 && hours <= 720))
  ) {
    return { ok: false, reason: "invalid" };
  }
  const now = Date.now();
  const { data, error } = await ctx.admin
    .from("site_announcements")
    .insert({
      level,
      body_zh: bodyZh,
      body_en: bodyEn,
      starts_at: new Date(now).toISOString(),
      ends_at:
        hours === null ? null : new Date(now + hours * 3_600_000).toISOString(),
      created_by: ctx.user.id,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, reason: "failed" };
  await logAudit(
    ctx.user.id,
    "site_announcement_post",
    { type: "setting", id: data.id },
    { level, hours },
  );
  refresh();
  return { ok: true };
}

/** Ends an announcement now. */
export async function endSiteAnnouncement(id: unknown): Promise<OpsResult> {
  const ctx = await asAdmin();
  if (!ctx) return { ok: false, reason: "unavailable" };
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) {
    return { ok: false, reason: "invalid" };
  }
  const { error } = await ctx.admin
    .from("site_announcements")
    .update({ ends_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, reason: "failed" };
  await logAudit(ctx.user.id, "site_announcement_end", {
    type: "setting",
    id,
  });
  refresh();
  return { ok: true };
}
