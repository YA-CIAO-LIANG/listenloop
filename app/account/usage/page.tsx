import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { quotaReport, type QuotaRow } from "@/auth/quota-report";
import { getSignedInUser } from "@/auth/session";
import { Card } from "@/components/Card";
import { QUOTA_WARN_SHARE, usageShare } from "@/lib/quota";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("quota");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * My quota (D161): each allowance used, left, and when it resets, with
 * a warning from 80%, the fixed limits, and any change an admin made.
 */
export default async function QuotaPage() {
  const user = await getSignedInUser();
  if (!user) redirect("/login?next=/account/usage");
  const [t, format, report] = await Promise.all([
    getTranslations("quota"),
    getFormatter(),
    quotaReport(user),
  ]);
  const when = (iso: string) =>
    format.dateTime(new Date(iso), {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Taipei",
    });
  const amount = (row: QuotaRow, value: number) =>
    t(`units.${row.unit}`, { n: format.number(value) });

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <Link
        href="/account"
        className="tap text-supporting text-ink-muted hover:text-ink"
      >
        <span aria-hidden="true">← </span>
        {t("back")}
      </Link>
      <h1 className="mt-6 font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">
        {t("intro", { plan: t(`plans.${report.plan}`) })}
      </p>

      {report.aiSuspended !== null && (
        <p role="alert" className="mt-6 max-w-reading text-error">
          {t("suspended")}
        </p>
      )}

      <ul className="mt-8 max-w-practice space-y-4">
        {report.rows.map((row) => {
          const share = usageShare(row.used, row.max);
          const warn = share !== null && share >= QUOTA_WARN_SHARE;
          const left =
            row.max === null ? null : Math.max(0, row.max - row.used);
          return (
            <li key={row.id}>
              <Card>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-medium">{t(`rows.${row.id}`)}</h2>
                  <p className="text-supporting tabular-nums">
                    {row.max === null
                      ? t("unlimitedUsed", { used: amount(row, row.used) })
                      : t("usedOf", {
                          used: amount(row, row.used),
                          max: amount(row, row.max),
                        })}
                  </p>
                </div>
                {share !== null && (
                  <div
                    role="meter"
                    aria-label={t(`rows.${row.id}`)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(share * 100)}
                    className="mt-3 h-1 w-full overflow-hidden rounded-full bg-line"
                  >
                    <div
                      className={`h-full ${warn ? "bg-error" : "bg-accent"}`}
                      style={{ width: `${Math.round(share * 100)}%` }}
                    />
                  </div>
                )}
                <p className="mt-2 text-supporting text-ink-muted">
                  {left !== null && t("left", { left: amount(row, left) })}
                  {left !== null && " · "}
                  {row.resetsAt
                    ? t("resets", { at: when(row.resetsAt) })
                    : t("noReset")}
                </p>
                {warn && (
                  <p className="mt-2 text-supporting font-medium text-error">
                    {share >= 1 ? t("usedUp") : t("almost")}
                  </p>
                )}
              </Card>
            </li>
          );
        })}
      </ul>

      {report.overrides.length > 0 && (
        <section
          aria-labelledby="quota-overrides"
          className="mt-12 max-w-practice"
        >
          <h2 id="quota-overrides" className="font-display text-h2">
            {t("overridesTitle")}
          </h2>
          <ul className="mt-4 space-y-2 text-supporting">
            {report.overrides.map((o) => (
              <li key={`${o.limit}-${o.expiresAt}`}>
                {t("override", {
                  limit: t(`rows.${o.limit}`),
                  extra: o.extra > 0 ? `+${o.extra}` : String(o.extra),
                  until: when(o.expiresAt),
                })}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="quota-fixed" className="mt-12 max-w-practice">
        <h2 id="quota-fixed" className="font-display text-h2">
          {t("fixedTitle")}
        </h2>
        <dl className="mt-4 divide-y divide-line border-y border-line text-supporting">
          {(
            [
              [
                "charsPerPractice",
                report.fixed.charsPerPractice === null
                  ? t("unlimited")
                  : t("chars", {
                      n: format.number(report.fixed.charsPerPractice),
                    }),
              ],
              [
                "maxPracticeSeconds",
                report.fixed.maxPracticeSeconds === null
                  ? t("unlimited")
                  : t("minutes", {
                      n: format.number(report.fixed.maxPracticeSeconds / 60),
                    }),
              ],
              [
                "uploadMegabytes",
                !report.fixed.uploadAudio
                  ? t("notIncluded")
                  : report.fixed.uploadMegabytes === null
                    ? t("unlimited")
                    : t("units.megabytes", { n: report.fixed.uploadMegabytes }),
              ],
              ["reportsPerDay", t("perDay", { n: report.fixed.reportsPerDay })],
              [
                "feedbackPerDay",
                t("perDay", { n: report.fixed.feedbackPerDay }),
              ],
              ["aiPerHour", t("perHour", { n: report.fixed.aiPerHour })],
            ] as const
          ).map(([id, value]) => (
            <div key={id} className="flex flex-wrap justify-between gap-2 py-3">
              <dt className="text-ink-muted">{t(`fixed.${id}`)}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-supporting text-ink-muted">
          {t("more")}{" "}
          <Link
            href="/pricing"
            className="text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink"
          >
            {t("pricing")}
          </Link>
        </p>
      </section>
    </main>
  );
}
