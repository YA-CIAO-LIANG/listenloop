import { timingSafeEqual } from "node:crypto";

/**
 * The scheduled jobs' routes (D156) answer only a request with
 * `Authorization: Bearer <CRON_SECRET>`. Without CRON_SECRET set they
 * don't exist (404), so nobody can run them.
 */
export function cronAuthorized(
  header: string | null,
  secret: string | undefined = process.env.CRON_SECRET,
): "ok" | "unauthorized" | "off" {
  const expected = secret?.trim();
  if (!expected || expected.length < 16) return "off";
  const given = header?.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? "ok" : "unauthorized";
}
