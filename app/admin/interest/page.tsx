import type { Metadata } from "next";
import { YOUTUBE_LINK_PRACTICES_ENABLED } from "@/lib/features";
import { ScrollRegion } from "@/components/ScrollRegion";
import { getFormatter, getTranslations } from "next-intl/server";
import { getAdminSupabase } from "@/auth/admin";
import { StatTile } from "@/components/StatTile";
import { funnel, shares, weeklyTrend, type IntentRow } from "@/lib/interest";
import { INTENT_STEPS } from "@/lib/intent";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.interest");
  return { title: t("title") };
}

/** How far back the page reads. */
const DAYS = 90;

/** The time `days` days ago, as ISO (read per request). */
function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

/**
 * Interest in paying (D102): the fake doors' funnel — saw the pricing
 * page, switched the billing period, pressed subscribe, joined the list —
 * with conversion from the first step, a weekly trend, and which plans,
 * periods, and pages people chose and came from. Unlock clicks (colors,
 * D93) are counted on their own.
 */
export default async function AdminInterestPage() {
  const [t, format] = await Promise.all([
    getTranslations("admin.interest"),
    getFormatter(),
  ]);
  const admin = getAdminSupabase();
  const since = daysAgo(DAYS);
  const { data } = admin
    ? await admin
        .from("intent_events")
        .select(
          "created_at, user_id, visitor_id, step, plan, billing_interval, source",
        )
        .gte("created_at", since)
        .order("created_at")
        .limit(20_000)
    : { data: [] };
  // While YouTube links are paused (D131), their clicks aren't listed;
  // the rows stay in the database.
  const rows = ((data ?? []) as IntentRow[]).filter(
    (row) => YOUTUBE_LINK_PRACTICES_ENABLED || row.source !== "youtube",
  );
  const steps = funnel(rows);
  const trend = weeklyTrend(rows, new Date());
  const percent = (n: number) =>
    format.number(n, { style: "percent", maximumFractionDigits: 1 });
  const tables = [
    ["plans", shares(rows, "subscribe_click", "plan")],
    ["periods", shares(rows, "subscribe_click", "billing_interval")],
    ["sources", shares(rows, "pricing_view", "source")],
    ["unlocks", shares(rows, "unlock_click", "source")],
  ] as const;

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">
        {t("intro", { days: DAYS })}
      </p>
      {!admin && <p className="mt-4 text-error">{t("noKey")}</p>}

      <dl className="mt-8 grid grid-cols-2 gap-4 wide:grid-cols-5">
        {steps.map((s) => (
          <StatTile
            key={s.step}
            label={t(`steps.${s.step}`)}
            value={format.number(s.people)}
            note={
              s.rate === null ? t("base") : t("rate", { rate: percent(s.rate) })
            }
          />
        ))}
      </dl>

      <section className="mt-12 space-y-3">
        <h2 className="font-display text-h2">{t("trendTitle")}</h2>
        <ScrollRegion label={t("trendTitle")}>
          <table className="w-full min-w-120 text-left text-supporting tabular-nums">
            <thead>
              <tr className="border-b border-line">
                <th
                  scope="col"
                  className="py-2 pr-4 font-normal text-ink-muted"
                >
                  {t("week")}
                </th>
                {INTENT_STEPS.map((step) => (
                  <th key={step} scope="col" className="px-2 py-2 font-medium">
                    {t(`steps.${step}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trend.map((w) => (
                <tr key={w.week} className="border-b border-line">
                  <th scope="row" className="py-2 pr-4 font-normal">
                    {w.week}
                  </th>
                  {INTENT_STEPS.map((step) => (
                    <td key={step} className="px-2 py-2">
                      {w.counts[step]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollRegion>
      </section>

      <div className="mt-12 grid gap-8 split:grid-cols-2">
        {tables.map(([name, list]) => (
          <section key={name} className="space-y-3">
            <h2 className="font-display text-h3">{t(`${name}Title`)}</h2>
            {list.length === 0 ? (
              <p className="text-ink-muted">{t("empty")}</p>
            ) : (
              <table className="w-full text-left text-supporting tabular-nums">
                <tbody>
                  {list.map((row) => (
                    <tr key={row.value} className="border-b border-line">
                      <th scope="row" className="py-2 pr-4 font-normal">
                        {row.value}
                      </th>
                      <td className="py-2 pr-4">{row.people}</td>
                      <td className="py-2">{percent(row.share)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
