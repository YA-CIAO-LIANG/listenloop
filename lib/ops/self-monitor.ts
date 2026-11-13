/**
 * The site starts its own monitor from the public health check (D163):
 * UptimeRobot loads /api/health every 5 minutes; at most once per
 * MONITOR_GAP_SECONDS one of those loads also runs the full monitor
 * (claimed in the database, so parallel loads don't run it twice), and
 * once a day, from 03:00 Taiwan time, the daily chores too. GitHub
 * Actions still calls /api/cron/monitor every 6 hours as the backup.
 */
export const SELF_MONITOR = {
  /** Just under 15 minutes, so a 5-minute check runs it every 15. */
  monitorGapSeconds: 14 * 60,
  /** Once a day; 20 hours so a late run doesn't push the next day out. */
  dailyGapSeconds: 20 * 60 * 60,
  /** Taiwan hour from which the daily chores may run (quiet hours). */
  dailyFromHour: 3,
} as const;

/** The Taiwan (UTC+8) hour of an instant, 0–23. */
export function taiwanHour(now: Date): number {
  return (now.getUTCHours() + 8) % 24;
}

/** Whether today's chores may start now (claimed separately). */
export function dailyWindow(now: Date): boolean {
  return taiwanHour(now) >= SELF_MONITOR.dailyFromHour;
}

/** Off with SELF_MONITOR=off (the end-to-end tests, local runs). */
export function selfMonitorEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.SELF_MONITOR !== "off";
}
