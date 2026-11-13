import { runHealthChecks } from "@/auth/ops";
import { healthStatus, type HealthChecks } from "@/lib/ops/alerts";

/**
 * Public health check (D156): the overall state and each part as ok or
 * fail, nothing else (no messages, versions, or numbers). The AI
 * providers aren't called here (the monitor does that), and the answer
 * is reused for 30 s, so loading this URL can't run up anything. It
 * also reads the database, which keeps Supabase's free project from
 * pausing after a week without activity.
 */
export const dynamic = "force-dynamic";

let cached: { at: number; checks: HealthChecks } | null = null;

export async function GET() {
  const now = Date.now();
  if (!cached || now - cached.at > 30_000) {
    cached = { at: now, checks: await runHealthChecks(false) };
  }
  const status = healthStatus(cached.checks);
  return Response.json(
    { status, checks: cached.checks },
    {
      status: status === "down" ? 503 : 200,
      headers: { "cache-control": "no-store" },
    },
  );
}
