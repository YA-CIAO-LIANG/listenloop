import { after } from "next/server";
import { runHealthChecks, runMonitorIfDue } from "@/auth/ops";
import { healthStatus, type HealthChecks } from "@/lib/ops/alerts";

/**
 * Public health check (D156): the overall state and each part as ok or
 * fail, nothing else (no messages, versions, or numbers). The AI
 * providers aren't called here (the monitor does that), and the answer
 * is reused for 30 s, so loading this URL can't run up anything. It
 * also reads the database, which keeps Supabase's free project from
 * pausing after a week without activity.
 *
 * After answering, it may start the full monitor (D163): at most once
 * per 15 minutes however often it's loaded (a database claim decides),
 * so UptimeRobot's 5-minute checks keep monitoring going while GitHub
 * Actions only runs every 6 hours.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

let cached: { at: number; checks: HealthChecks } | null = null;

export async function GET() {
  const now = Date.now();
  if (!cached || now - cached.at > 30_000) {
    cached = { at: now, checks: await runHealthChecks(false) };
  }
  const status = healthStatus(cached.checks);
  after(() => runMonitorIfDue(new Date()));
  return Response.json(
    { status, checks: cached.checks },
    {
      status: status === "down" ? 503 : 200,
      headers: { "cache-control": "no-store" },
    },
  );
}
