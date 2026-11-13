import { getAdminSupabase } from "@/auth/admin";
import { runMonitor } from "@/auth/ops";
import { cronAuthorized } from "@/lib/ops/cron-auth";

/**
 * The monitor (D156), called every 15 minutes by .github/workflows/ops.yml
 * with CRON_SECRET: health checks (the AI providers' free connection
 * checks too), the site's numbers, and alerts. `?daily=1` (once a day)
 * also prunes old logs and samples the database and storage sizes.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = cronAuthorized(request.headers.get("authorization"));
  if (auth === "off") return new Response(null, { status: 404 });
  if (auth === "unauthorized") return new Response(null, { status: 401 });
  const admin = getAdminSupabase();
  if (!admin) return Response.json({ ok: false }, { status: 503 });
  const daily = new URL(request.url).searchParams.get("daily") === "1";
  const result = await runMonitor(admin, new Date(), { daily });
  return Response.json(
    { ok: true, ...result },
    { headers: { "cache-control": "no-store" } },
  );
}
