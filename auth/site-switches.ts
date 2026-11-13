import { supabaseConfig } from "@/lib/supabase/config";
import {
  activeAnnouncements,
  DEFAULT_SWITCHES,
  parseAnnouncement,
  parseSwitches,
  pauseReason,
  type GuardedFeature,
  type PauseReason,
  type SiteAnnouncement,
  type SiteSwitches,
} from "@/lib/site-switches";

/**
 * The emergency switches and site announcements (D155), read with the
 * public key (both tables are readable by anyone) so the proxy can use
 * them too. Kept in memory for SITE_SWITCHES_TTL_MS (30 s by default) in
 * each server instance: a switch takes effect everywhere within 30 s.
 * A read that fails keeps the site on (never off by accident).
 */

function ttlMs(): number {
  const raw = Number(process.env.SITE_SWITCHES_TTL_MS);
  return Number.isFinite(raw) && raw >= 0 ? raw : 30_000;
}

type Cached<T> = { value: T; at: number };
let switchesCache: Cached<SiteSwitches> | null = null;
let announcementsCache: Cached<SiteAnnouncement[]> | null = null;

async function readPublic(path: string): Promise<unknown[] | null> {
  if (!supabaseConfig) return null;
  try {
    const response = await fetch(`${supabaseConfig.url}/rest/v1/${path}`, {
      headers: {
        apikey: supabaseConfig.publishableKey,
        authorization: `Bearer ${supabaseConfig.publishableKey}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(2_000),
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

export async function getSiteSwitches(): Promise<SiteSwitches> {
  const now = Date.now();
  if (switchesCache && now - switchesCache.at < ttlMs()) {
    return switchesCache.value;
  }
  const rows = await readPublic(
    "site_settings?select=maintenance,read_only,features&limit=1",
  );
  const value = rows ? parseSwitches(rows[0]) : DEFAULT_SWITCHES;
  switchesCache = { value, at: now };
  return value;
}

export async function getActiveAnnouncements(): Promise<SiteAnnouncement[]> {
  const now = Date.now();
  if (!announcementsCache || now - announcementsCache.at >= ttlMs()) {
    const rows = await readPublic(
      "site_announcements?select=id,level,body_zh,body_en,starts_at,ends_at&order=starts_at.desc&limit=20",
    );
    announcementsCache = {
      value: (rows ?? []).flatMap((row) => parseAnnouncement(row) ?? []),
      at: now,
    };
  }
  return activeAnnouncements(announcementsCache.value, new Date(now));
}

/** After an admin's change: this instance reads the row again at once. */
export function clearSiteSwitchCache(): void {
  switchesCache = null;
  announcementsCache = null;
}

/**
 * Why `feature` is paused for this person, or null when they may use it.
 * Admins are never paused.
 */
export async function featurePaused(
  user: { role?: string } | null,
  feature: GuardedFeature,
): Promise<PauseReason | null> {
  if (user?.role === "admin") return null;
  return pauseReason(await getSiteSwitches(), feature);
}
