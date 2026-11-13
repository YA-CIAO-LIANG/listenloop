import { getFormatter, getTranslations } from "next-intl/server";
import type { Forecasts } from "@/auth/forecasts";
import type { CapacityForecast } from "@/lib/ops/forecast";
import type { WeeklySummary } from "@/lib/ops/weekly";
import { StatTile } from "./StatTile";

/**
 * Forecasts and weekly summaries on /admin/usage (D156): when the Azure
 * credit runs out and Supabase's free tier fills at the recent pace.
 */
export async function OpsForecast({
  forecasts,
  weeks,
}: {
  forecasts: Forecasts;
  weeks: WeeklySummary[];
}) {
  const [t, format] = await Promise.all([
    getTranslations("adminUsage.forecast"),
    getFormatter(),
  ]);
  const usd = (micros: number) =>
    format.number(micros / 1e6, { style: "currency", currency: "USD" });
  const day = (iso: string) =>
    format.dateTime(new Date(`${iso}T00:00:00`), { dateStyle: "medium" });
  const mb = (bytes: number) =>
    `${format.number(bytes / 1024 / 1024, { maximumFractionDigits: 0 })} MB`;
  const { credit } = forecasts;
  const capacity = (f: CapacityForecast | null) =>
    !f
      ? { value: t("noSamples"), note: t("noSamplesNote") }
      : {
          value: f.fullOn ? day(f.fullOn) : t("notGrowing"),
          note: t("capacityNote", {
            now: mb(f.latestBytes),
            perDay: mb(Math.max(0, f.perDayBytes)),
          }),
        };
  const database = capacity(forecasts.database);
  const storage = capacity(forecasts.storage);

  return (
    <section aria-labelledby="usage-forecast" className="mt-12">
      <h2 id="usage-forecast" className="font-display text-h2">
        {t("title")}
      </h2>
      <p className="mt-2 max-w-reading text-supporting text-ink-muted">
        {t("intro")}
      </p>
      <dl className="mt-6 grid grid-cols-1 gap-4 split:grid-cols-3">
        <StatTile
          label={t("credit")}
          value={
            credit.runsOutOn && !credit.expiresFirst
              ? day(credit.runsOutOn)
              : t("lastsToExpiry")
          }
          note={t("creditNote", {
            perDay: usd(credit.perDayMicros),
            left: usd(credit.leftMicros),
            days: credit.days,
          })}
        />
        <StatTile
          label={t("database")}
          value={database.value}
          note={database.note}
        />
        <StatTile
          label={t("storage")}
          value={storage.value}
          note={storage.note}
        />
      </dl>
      <p className="mt-4 text-supporting text-ink-muted">
        {t("vercel")}{" "}
        <a
          href="https://vercel.com/dashboard/usage"
          className="text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink"
          rel="noreferrer"
          target="_blank"
        >
          {t("vercelLink")}
        </a>
      </p>

      <h3 className="mt-8 font-medium">{t("weeksTitle")}</h3>
      {weeks.length === 0 ? (
        <p className="mt-2 text-supporting text-ink-muted">{t("noWeeks")}</p>
      ) : (
        <ul className="mt-2 divide-y divide-line border-y border-line">
          {weeks.map((w) => (
            <li key={w.weekStart} className="py-3 text-supporting">
              <p className="font-medium">
                {t("week", { start: day(w.weekStart), end: day(w.weekEnd) })}
              </p>
              <p className="mt-1 text-ink-muted">
                {t("weekLine", {
                  spend: usd(w.totalMicros),
                  users: w.newUsers,
                  practices: w.newPractices,
                  active: w.activeUsers,
                })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
