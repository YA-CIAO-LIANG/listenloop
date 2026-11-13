import { getAdminSupabase } from "@/auth/admin";
import { loadForecasts } from "@/auth/forecasts";
import { cronAuthorized } from "@/lib/ops/cron-auth";
import { discordText, sendDiscord } from "@/lib/ops/notify";
import {
  parseOperations,
  weeklyLines,
  type WeeklySummary,
} from "@/lib/ops/weekly";
import { usageWeek } from "@/lib/usage-report";

/**
 * The weekly usage and cost summary (D156), every Monday morning by
 * .github/workflows/ops.yml: last week (Monday to Sunday, Taiwan time),
 * kept in weekly_reports and sent to Discord when it's set up.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DAY_MS = 86_400_000;

export async function POST(request: Request) {
  const auth = cronAuthorized(request.headers.get("authorization"));
  if (auth === "off") return new Response(null, { status: 404 });
  if (auth === "unauthorized") return new Response(null, { status: 401 });
  const admin = getAdminSupabase();
  if (!admin) return Response.json({ ok: false }, { status: 503 });

  const now = new Date();
  // This week's Monday; the summary is about the week before it.
  const thisWeek = new Date(usageWeek(now).start);
  const start = new Date(thisWeek.getTime() - 7 * DAY_MS);
  const { data } = await admin.rpc("weekly_numbers", {
    week_start: start.toISOString(),
    week_end: thisWeek.toISOString(),
  });
  const numbers = (data ?? {}) as Record<string, unknown>;
  const byOperation = parseOperations(numbers.by_operation);
  const forecasts = await loadForecasts(
    admin,
    now,
    Number(numbers.azure_micros) || 0,
  );
  const taiwanDate = (d: Date) =>
    new Date(d.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
  const summary: WeeklySummary = {
    weekStart: taiwanDate(start),
    weekEnd: taiwanDate(new Date(thisWeek.getTime() - DAY_MS)),
    totalMicros: byOperation.reduce((sum, o) => sum + o.micros, 0),
    byOperation,
    newUsers: Number(numbers.new_users) || 0,
    newPractices: Number(numbers.new_practices) || 0,
    activeUsers: Number(numbers.active_users) || 0,
    ...forecasts,
  };
  await admin
    .from("weekly_reports")
    .upsert({ week_start: summary.weekStart, summary });
  const sent = await sendDiscord(
    discordText("ListenLoop 每週用量摘要", weeklyLines(summary)),
  );
  return Response.json(
    { ok: true, weekStart: summary.weekStart, sent },
    { headers: { "cache-control": "no-store" } },
  );
}
