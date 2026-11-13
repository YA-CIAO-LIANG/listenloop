/**
 * Emergency switches (D155): admins turn the site, or parts of it, off
 * from /admin/ops when something goes wrong (an outage, abuse, runaway
 * costs). Pure logic here; reading the row is auth/site-switches.ts.
 *
 * - maintenance: everyone but admins sees the maintenance page.
 * - readOnly: browsing and practising go on; everything that creates,
 *   uploads, shares, or signs up is paused.
 * - features: each risky feature on its own.
 *
 * Admins are never blocked, so they can check and fix things.
 */

export const SWITCHABLE_FEATURES = [
  "aiGenerate",
  "aiRevise",
  "uploadAudio",
  "transcribe",
  "publicShare",
  "signup",
] as const;

export type SwitchableFeature = (typeof SWITCHABLE_FEATURES)[number];

/** A switchable feature, or making a practice at all (paused by read-only). */
export type GuardedFeature = SwitchableFeature | "create";

export type SiteSwitches = {
  maintenance: boolean;
  readOnly: boolean;
  /** false: that feature is paused. */
  features: Record<SwitchableFeature, boolean>;
};

export const DEFAULT_SWITCHES: SiteSwitches = {
  maintenance: false,
  readOnly: false,
  features: Object.fromEntries(
    SWITCHABLE_FEATURES.map((feature) => [feature, true]),
  ) as Record<SwitchableFeature, boolean>,
};

/**
 * The switches from a site_settings row. Anything missing or malformed
 * means "on": a broken row must never take the site down.
 */
export function parseSwitches(row: unknown): SiteSwitches {
  if (!row || typeof row !== "object") return DEFAULT_SWITCHES;
  const value = row as Record<string, unknown>;
  const features = (
    value.features && typeof value.features === "object" ? value.features : {}
  ) as Record<string, unknown>;
  return {
    maintenance: value.maintenance === true,
    readOnly: value.read_only === true || value.readOnly === true,
    features: Object.fromEntries(
      SWITCHABLE_FEATURES.map((feature) => [
        feature,
        features[feature] !== false,
      ]),
    ) as Record<SwitchableFeature, boolean>,
  };
}

/** Why a feature is paused, or null when it's open. */
export type PauseReason = "maintenance" | "readOnly" | "off";

export function pauseReason(
  switches: SiteSwitches,
  feature: GuardedFeature,
): PauseReason | null {
  if (switches.maintenance) return "maintenance";
  if (switches.readOnly) return "readOnly";
  if (feature === "create") return null;
  return switches.features[feature] ? null : "off";
}

/** Every feature paused now (read-only pauses them all). */
export function pausedFeatures(switches: SiteSwitches): SwitchableFeature[] {
  return SWITCHABLE_FEATURES.filter(
    (feature) => pauseReason(switches, feature) !== null,
  );
}

/** The site's state in one word, for the status page and the admin. */
export type SiteState = "normal" | "maintenance" | "readOnly" | "partial";

export function siteState(switches: SiteSwitches): SiteState {
  if (switches.maintenance) return "maintenance";
  if (switches.readOnly) return "readOnly";
  return pausedFeatures(switches).length > 0 ? "partial" : "normal";
}

/**
 * Pages that stay open in maintenance mode: the maintenance and status
 * pages, signing in (so admins can), health checks, the legal pages.
 */
const MAINTENANCE_OPEN = [
  "/maintenance",
  "/status",
  "/login",
  "/auth",
  "/api/health",
  "/api/cron",
  "/privacy",
  "/terms",
];

export function openInMaintenance(pathname: string): boolean {
  return MAINTENANCE_OPEN.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

/** Site announcements (D155): shown on every page and on /status. */
export const ANNOUNCEMENT_LEVELS = ["info", "warning", "critical"] as const;
export type AnnouncementLevel = (typeof ANNOUNCEMENT_LEVELS)[number];
export const SITE_ANNOUNCEMENT_MAX = 500;

export type SiteAnnouncement = {
  id: string;
  level: AnnouncementLevel;
  bodyZh: string;
  bodyEn: string;
  startsAt: string;
  endsAt: string | null;
};

export function parseAnnouncement(row: unknown): SiteAnnouncement | null {
  if (!row || typeof row !== "object") return null;
  const value = row as Record<string, unknown>;
  const level = ANNOUNCEMENT_LEVELS.find((l) => l === value.level);
  if (
    typeof value.id !== "string" ||
    !level ||
    typeof value.body_zh !== "string" ||
    typeof value.body_en !== "string" ||
    typeof value.starts_at !== "string"
  ) {
    return null;
  }
  return {
    id: value.id,
    level,
    bodyZh: value.body_zh,
    bodyEn: value.body_en,
    startsAt: value.starts_at,
    endsAt: typeof value.ends_at === "string" ? value.ends_at : null,
  };
}

/** Announcements showing at `now`, newest first. */
export function activeAnnouncements(
  all: SiteAnnouncement[],
  now: Date,
): SiteAnnouncement[] {
  const t = now.getTime();
  return all
    .filter(
      (a) =>
        Date.parse(a.startsAt) <= t &&
        (a.endsAt === null || Date.parse(a.endsAt) > t),
    )
    .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt));
}
