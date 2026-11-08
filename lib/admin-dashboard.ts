import { usagePeriodStarts } from "./usage-report";

/**
 * The admin dashboard (D56): its sections, in nav order, and the periods
 * its numbers cover. Supabase Free's limits are here so the overview can
 * show how much is used.
 */
export const ADMIN_SECTIONS = [
  { id: "overview", href: "/admin" },
  { id: "official", href: "/admin/official" },
  { id: "users", href: "/admin/users" },
  { id: "materials", href: "/admin/materials" },
  { id: "reports", href: "/admin/reports" },
  { id: "sentences", href: "/admin/sentences" },
  { id: "usage", href: "/admin/usage" },
  { id: "revenue", href: "/admin/revenue" },
  { id: "interest", href: "/admin/interest" },
  { id: "forecast", href: "/admin/forecast" },
  { id: "events", href: "/admin/events" },
  { id: "feedback", href: "/admin/feedback" },
  { id: "errors", href: "/admin/errors" },
  { id: "audit", href: "/admin/audit" },
] as const;
export type AdminSection = (typeof ADMIN_SECTIONS)[number]["id"];

/** Supabase Free (checked 2026-11-06, D46): database and file storage. */
export const SUPABASE_FREE = {
  databaseBytes: 500 * 1024 * 1024,
  storageBytes: 1024 * 1024 * 1024,
} as const;

/** Rows a list page shows at most. */
export const ADMIN_PAGE_ROWS = 100;

/** Today (Taiwan time), the last 7 days, and this month, as ISO instants. */
export function adminPeriods(now: Date): {
  dayStart: string;
  weekStart: string;
  monthStart: string;
} {
  const { dayStart, monthStart } = usagePeriodStarts(now);
  const weekStart = new Date(
    new Date(dayStart).getTime() - 6 * 24 * 60 * 60 * 1000,
  ).toISOString();
  return { dayStart, weekStart, monthStart };
}

/** A share of a limit, 0–1, for "12% of 500 MB". */
export const shareOf = (used: number, limit: number) =>
  limit > 0 ? Math.min(1, used / limit) : 0;

/** Today's date in Taiwan (UTC+8), as learners' local dates mostly are. */
export function taiwanToday(now: Date): string {
  return new Date(now.getTime() + 8 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}
