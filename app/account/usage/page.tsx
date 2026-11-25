import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { quotaReport, type QuotaRow } from "@/auth/quota-report";
import { settleReferralsFor } from "@/auth/referral";
import { getSignedInUser } from "@/auth/session";
import { Card } from "@/components/Card";
import { ReferralLink } from "@/components/ReferralLink";
import { QUOTA_WARN_SHARE, usageShare } from "@/lib/quota";
import {
  REFERRAL_BONUS_MINUTES,
  REFERRAL_VALID_DAYS,
  referralUrl,
} from "@/lib/referral";
import { SITE_URL } from "@/lib/site";
import { planLabel, type PlanNameTranslator } from "@/lib/plan-names";
import { lineHasListening, lineHasWriting, planParts } from "@/lib/plans";
import { UpsellToAll } from "@/components/UpsellToAll";
import { secondsToWords, WORDS_PER_MINUTE } from "@/lib/units";

/** The meters by part (D210): what the plan's line includes. */
const QUOTA_GROUPS: readonly (readonly [
  "listening" | "writing" | "other",
  readonly QuotaRow["id"][],
])[] = [
  [
    "listening",
    ["wordsPerWeek", "wordsPerMonth", "revisesPerDay", "storageMegabytes"],
  ],
  [
    "writing",
    ["writingReviewsPerWeek", "backChecksPerWeek", "chatMessagesPerWeek"],
  ],
  ["other", ["dailyAi"]],
];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("quota");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * My quota (D161): each allowance used, left, and when it resets, with
 * a warning from 80%, the fixed limits, and any change an admin made;
 * and the referral program (D177): the link, who came, what was earned.
 */
export default async function QuotaPage() {
  const user = await getSignedInUser();
  if (!user) redirect("/login?next=/account/usage");
  // A friend's Day 1 since the last visit counts before the numbers show.
  await settleReferralsFor(user.id);
  const [t, tPlans, format, report] = await Promise.all([
    getTranslations("quota"),
    getTranslations("planNames"),
    getFormatter(),
    quotaReport(user),
  ]);
  const tn = tPlans as unknown as PlanNameTranslator;
  const parts = planParts(report.plan);
  // In the learner's own time zone (D139; the formatter's default), as
  // "11/16 週一 00:00", like the create page (D170).
  const when = (iso: string) =>
    format.dateTime(new Date(iso), {
      month: "numeric",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
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
        {t("intro", { plan: planLabel(report.plan, tn) })}
      </p>

      {report.aiSuspended !== null && (
        <p role="alert" className="mt-6 max-w-reading text-error">
          {t("suspended")}
        </p>
      )}

      {QUOTA_GROUPS.map(([group, ids]) => {
        const rows = report.rows.filter((row) => ids.includes(row.id));
        if (rows.length === 0) return null;
        const part = group === "other" ? null : group;
        const free =
          part !== null &&
          parts !== null &&
          !(part === "listening"
            ? lineHasListening(parts.line)
            : lineHasWriting(parts.line));
        return (
          <section
            key={group}
            aria-labelledby={`quota-${group}`}
            className="mt-10 max-w-practice"
          >
            <h2 id={`quota-${group}`} className="font-display text-h2">
              {t(`groups.${group}`)}
            </h2>
            {free && (
              <p className="mt-2 text-supporting text-ink-muted">
                {t(`groupsFree.${part}`)}
              </p>
            )}
            {part && (
              <div className="mt-2">
                <UpsellToAll need={part} feature="quota" />
              </div>
            )}
            <ul className="mt-4 space-y-4">
              {rows.map((row) => {
                const share = usageShare(row.used, row.max);
                const warn = share !== null && share >= QUOTA_WARN_SHARE;
                const left =
                  row.max === null ? null : Math.max(0, row.max - row.used);
                return (
                  <li key={row.id}>
                    <Card>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="font-medium">{t(`rows.${row.id}`)}</h3>
                        <p className="text-supporting tabular-nums">
                          {row.max === null
                            ? t("unlimitedUsed", {
                                used: amount(row, row.used),
                              })
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
                        {left !== null &&
                          t("left", { left: amount(row, left) })}
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
                      {/* Used up: what to do next, not a dead end (D170). */}
                      {share !== null &&
                        share >= 1 &&
                        report.plan !== "admin" && (
                          <p className="mt-1 text-supporting">
                            <Link
                              href="/pricing?from=quota"
                              className="text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink"
                            >
                              {t("upgrade")}
                            </Link>
                          </p>
                        )}
                    </Card>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

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

      {report.referral?.code && (
        <section
          aria-labelledby="quota-referral"
          className="mt-12 max-w-practice"
        >
          <h2 id="quota-referral" className="font-display text-h2">
            {t("referral.title")}
          </h2>
          <p className="mt-4 max-w-reading text-ink-muted">
            {t("referral.intro", {
              words: REFERRAL_BONUS_MINUTES * WORDS_PER_MINUTE,
              days: REFERRAL_VALID_DAYS,
            })}
          </p>
          <ReferralLink url={referralUrl(SITE_URL, report.referral.code)} />
          <dl className="mt-6 grid grid-cols-2 gap-4 split:grid-cols-4">
            {(
              [
                [
                  "invited",
                  t("referral.people", { n: report.referral.invited }),
                ],
                [
                  "qualified",
                  t("referral.people", { n: report.referral.qualified }),
                ],
                [
                  "earned",
                  t("words", {
                    n: format.number(
                      report.referral.earnedMinutes * WORDS_PER_MINUTE,
                    ),
                  }),
                ],
                [
                  "left",
                  t("words", {
                    n: format.number(
                      Math.round(
                        report.referral.leftMinutes * WORDS_PER_MINUTE,
                      ),
                    ),
                  }),
                ],
              ] as const
            ).map(([id, value]) => (
              <div key={id}>
                <dt className="text-supporting text-ink-muted">
                  {t(`referral.stats.${id}`)}
                </dt>
                <dd className="mt-1 font-medium tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-supporting text-ink-muted">
            {t("referral.rules")}
          </p>
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
                  : t("wordsAbout", {
                      n: format.number(
                        secondsToWords(report.fixed.maxPracticeSeconds),
                      ),
                      minutes: format.number(
                        report.fixed.maxPracticeSeconds / 60,
                      ),
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
              [
                "writingWords",
                report.fixed.writingWords === null
                  ? t("unlimited")
                  : t("words", {
                      n: format.number(report.fixed.writingWords),
                    }),
              ],
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
