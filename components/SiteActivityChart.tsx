"use client";

import { useFormatter, useTranslations } from "next-intl";
import { ChartFrame } from "./charts/ChartFrame";
import { ColumnChart } from "./charts/ColumnChart";

/**
 * Learners active each day over the last 30 days, for the admin
 * dashboard (D75): counts only, no one is named.
 */
export function SiteActivityChart({
  days,
}: {
  days: readonly { date: string; active: number; minutes: number }[];
}) {
  const t = useTranslations("admin.overview");
  const format = useFormatter();
  const day = (date: string) =>
    // A calendar date, the same everywhere: noon UTC, shown in UTC.
    format.dateTime(new Date(`${date}T12:00:00Z`), {
      month: "numeric",
      day: "numeric",
      timeZone: "UTC",
    });
  return (
    <ChartFrame
      title={t("activityTitle")}
      summary={t("activitySummary", {
        days: days.length,
        peak: Math.max(0, ...days.map((d) => d.active)),
      })}
      columns={[
        { label: t("date") },
        { label: t("activeLearners"), numeric: true },
        { label: t("minutes"), numeric: true },
      ]}
      rows={days.map((d) => [day(d.date), d.active, d.minutes])}
    >
      <ColumnChart
        data={days.map((d) => ({
          label: day(d.date),
          value: d.active,
          tooltip: `${day(d.date)} · ${t("activeCount", { n: d.active })} · ${t("minutesCount", { n: d.minutes })}`,
        }))}
        format={(n) => String(Math.round(n))}
        tickEvery={5}
      />
    </ChartFrame>
  );
}
