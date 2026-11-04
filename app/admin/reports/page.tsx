import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { getAdminSupabase } from "@/auth/admin";
import { getAdminUser } from "@/auth/creator";
import {
  ModerationControls,
  RestorePracticeButton,
} from "@/components/ModerationControls";
import {
  isReportReason,
  tallyReasons,
  type ReportReason,
} from "@/lib/moderation";
import { customPracticeId } from "@/lib/practice-material";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("moderation");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * Report review (D31): open reports grouped by practice, oldest first,
 * each with take down or dismiss; then the practices taken down, which
 * can be restored. Admins only; read with the secret key, since reports
 * and others' private practices are hidden from users.
 */
export default async function ReportsPage() {
  const user = await getAdminUser();
  const admin = user && getAdminSupabase();
  if (!admin) notFound();
  const [t, tReasons, format] = await Promise.all([
    getTranslations("moderation"),
    getTranslations("report.reasons"),
    getFormatter(),
  ]);
  const [{ data: reports }, { data: removed }] = await Promise.all([
    admin
      .from("practice_reports")
      .select("id, practice_id, reason, details, created_at, practices(title)")
      .eq("status", "open")
      .order("created_at", { ascending: true }),
    admin
      .from("practices")
      .select("id, title, removed_at, removed_reason")
      .not("removed_at", "is", null)
      .order("removed_at", { ascending: false }),
  ]);

  const groups = new Map<
    string,
    { title: string; reports: NonNullable<typeof reports> }
  >();
  for (const report of reports ?? []) {
    const group = groups.get(report.practice_id) ?? {
      title: report.practices?.title ?? "",
      reports: [],
    };
    group.reports.push(report);
    groups.set(report.practice_id, group);
  }
  const date = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" });
  const reasonName = (reason: string) =>
    isReportReason(reason) ? tReasons(reason) : reason;

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">{t("intro")}</p>

      <section className="mt-12 max-w-practice">
        <h2 className="font-display text-h2">
          {t("openTitle", { count: groups.size })}
        </h2>
        {groups.size === 0 ? (
          <p className="mt-4 text-ink-muted">{t("noneOpen")}</p>
        ) : (
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {[...groups].map(([practiceId, group]) => {
              const tally = tallyReasons(
                group.reports
                  .map((r) => r.reason)
                  .filter((r): r is ReportReason => isReportReason(r)),
              );
              return (
                <li key={practiceId} className="space-y-3 py-4">
                  <Link
                    href={`/videos/${customPracticeId(practiceId)}`}
                    className="font-medium hover:text-accent-ink"
                  >
                    {group.title}
                  </Link>
                  <p className="text-supporting text-ink-muted">
                    {t("reportCount", { count: group.reports.length })} ·{" "}
                    {tally
                      .map(({ reason, count }) =>
                        t("reasonTally", { reason: tReasons(reason), count }),
                      )
                      .join("・")}
                  </p>
                  <ul className="space-y-2">
                    {group.reports.map((report) => (
                      <li key={report.id} className="text-supporting">
                        <span className="text-ink-muted tabular-nums">
                          {date(report.created_at)} ·{" "}
                          {reasonName(report.reason)}
                        </span>
                        {report.details && (
                          <span className="block whitespace-pre-line">
                            {report.details}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <ModerationControls
                    practiceId={practiceId}
                    title={group.title}
                    defaultReason={tally[0]?.reason ?? "other"}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-12 max-w-practice">
        <h2 className="font-display text-h2">{t("removedTitle")}</h2>
        {!removed?.length ? (
          <p className="mt-4 text-ink-muted">{t("noneRemoved")}</p>
        ) : (
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {removed.map((practice) => (
              <li
                key={practice.id}
                className="flex flex-wrap items-center justify-between gap-3 py-4"
              >
                <div>
                  <p className="font-medium">{practice.title}</p>
                  <p className="text-supporting text-ink-muted">
                    {t("removedMeta", {
                      reason: reasonName(practice.removed_reason ?? ""),
                      date: date(practice.removed_at ?? ""),
                    })}
                  </p>
                </div>
                <RestorePracticeButton
                  practiceId={practice.id}
                  title={practice.title}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
