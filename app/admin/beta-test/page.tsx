import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { getFormatter, getTranslations } from "next-intl/server";
import { getAdminSupabase } from "@/auth/admin";
import { getBetaTesters } from "@/auth/beta-test";
import { getSurveys } from "@/auth/surveys";
import { Button } from "@/components/Button";
import { ScrollRegion } from "@/components/ScrollRegion";
import { StatTile } from "@/components/StatTile";
import { SurveySummary } from "@/components/SurveySummary";
import { userNumberLabel } from "@/lib/accounts";
import { BETA_TEST, summarizeCohort, summarizeTester } from "@/lib/beta-test";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.betaTest");
  return { title: t("title") };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * The Beta test (D165, docs/beta-test-plan.md): every account that joined
 * with an invite (or one invite's), its progress, the last time it
 * practised, who needs a nudge, when to interview, and what testers said.
 */
export default async function AdminBetaTestPage({
  searchParams,
}: PageProps<"/admin/beta-test">) {
  const query = await searchParams;
  const invite =
    typeof query.invite === "string" && UUID.test(query.invite)
      ? query.invite
      : null;
  const [t, format] = await Promise.all([
    getTranslations("admin.betaTest"),
    getFormatter(),
  ]);
  const admin = getAdminSupabase();
  // Rendered per request: the days below count from now.
  await connection();
  const now = new Date();
  const [testers, { data: invites }] = await Promise.all([
    getBetaTesters(invite),
    admin
      ? admin
          .from("beta_invites")
          .select("id, code, note")
          .order("created_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: null }),
  ]);
  const rows = testers.map((row) => ({ row, s: summarizeTester(row, now) }));
  const cohort = summarizeCohort(rows.map((r) => r.s));
  const ids = testers.map((r) => r.userId);
  const [surveys, { data: feedback }] = await Promise.all([
    getSurveys({ userIds: ids }),
    admin && ids.length
      ? admin
          .from("feedback")
          .select("id, created_at, user_id, category, message")
          .in("user_id", ids)
          .order("created_at", { ascending: false })
          .limit(30)
      : Promise.resolve({ data: null }),
  ]);
  const numbers = new Map(
    testers.map((r) => [r.userId, userNumberLabel(r.number)]),
  );
  const share = (n: number) =>
    cohort.testers
      ? format.number(n / cohort.testers, { style: "percent" })
      : "—";
  const date = (iso: string | null) =>
    iso
      ? format.dateTime(new Date(iso), { month: "numeric", day: "numeric" })
      : "—";
  const priority = rows
    .filter((r) => r.s.followUp)
    .sort((a, b) => (b.s.daysIdle ?? 99) - (a.s.daysIdle ?? 99));

  return (
    <main className="mx-auto w-full max-w-content flex-1 space-y-12 px-4 py-12 split:px-6">
      <header className="space-y-4">
        <h1 className="font-display text-h1">{t("title")}</h1>
        <p className="max-w-reading text-ink-muted">
          {t("intro", { days: BETA_TEST.idleDays })}
        </p>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label htmlFor="invite" className="block text-supporting">
              {t("cohort")}
            </label>
            <select
              id="invite"
              name="invite"
              defaultValue={invite ?? ""}
              className="block min-h-11 rounded-base border border-line bg-surface px-3"
            >
              <option value="">{t("allInvites")}</option>
              {(invites ?? []).map((i) => (
                <option key={i.id} value={i.id}>
                  {i.note ? `${i.code} · ${i.note}` : i.code}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" variant="secondary">
            {t("show")}
          </Button>
        </form>
      </header>

      <section aria-labelledby="cohort-title" className="space-y-4">
        <h2 id="cohort-title" className="font-display text-h2">
          {t("cohortTitle")}
        </h2>
        <dl className="grid gap-3 split:grid-cols-5">
          <StatTile label={t("testers")} value={cohort.testers} />
          <StatTile
            label={t("startedDay1")}
            value={share(cohort.startedDay1)}
            note={t("people", { count: cohort.startedDay1 })}
          />
          <StatTile
            label={t("finishedWeek")}
            value={share(cohort.finishedWeek)}
            note={t("people", { count: cohort.finishedWeek })}
          />
          <StatTile
            label={t("activeRecently")}
            value={share(cohort.activeRecently)}
            note={t("activeNote", { days: BETA_TEST.idleDays })}
          />
          <StatTile label={t("followUps")} value={cohort.followUps} />
        </dl>
      </section>

      <section aria-labelledby="follow-title" className="space-y-4">
        <h2 id="follow-title" className="font-display text-h2">
          {t("followTitle")}
        </h2>
        {priority.length === 0 ? (
          <p className="text-ink-muted">{t("noFollowUps")}</p>
        ) : (
          <ul className="max-w-practice divide-y divide-line border-y border-line">
            {priority.map(({ row, s }) => (
              <li key={row.userId} className="py-3">
                <Link
                  href={`/admin/users/${row.number}`}
                  className="text-accent-ink underline underline-offset-4"
                >
                  {numbers.get(row.userId)}
                </Link>
                {" · "}
                {s.followUp === "notStarted"
                  ? t("reasons.notStarted", { days: s.daysSinceJoin })
                  : t("reasons.idle", { days: s.daysIdle ?? 0 })}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="testers-title" className="space-y-4">
        <h2 id="testers-title" className="font-display text-h2">
          {t("testersTitle")}
        </h2>
        {rows.length === 0 ? (
          <p className="text-ink-muted">{t("none")}</p>
        ) : (
          <ScrollRegion label={t("testersTitle")}>
            <table className="w-full min-w-200 text-left text-supporting tabular-nums">
              <thead>
                <tr className="border-b border-line text-ink-muted">
                  {(
                    [
                      "account",
                      "invite",
                      "joined",
                      "progress",
                      "finished",
                      "lastPractice",
                      "followUp",
                      "interview",
                    ] as const
                  ).map((column) => (
                    <th
                      key={column}
                      scope="col"
                      className="py-2 pr-4 font-normal"
                    >
                      {t(`columns.${column}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ row, s }) => (
                  <tr key={row.userId} className="border-b border-line">
                    <th scope="row" className="py-2 pr-4 font-normal">
                      <Link
                        href={`/admin/users/${row.number}`}
                        className="text-accent-ink underline underline-offset-4"
                      >
                        {numbers.get(row.userId)}
                      </Link>
                    </th>
                    <td className="py-2 pr-4">{row.inviteNote ?? "—"}</td>
                    <td className="py-2 pr-4">{date(row.joinedAt)}</td>
                    <td className="py-2 pr-4">
                      {s.current
                        ? t("progressText", {
                            week: s.current.week,
                            day: s.current.day,
                            materials: s.materials,
                          })
                        : t("notStarted")}
                    </td>
                    <td className="py-2 pr-4">
                      {s.finishedWeek ? t("yes") : t("no")}
                    </td>
                    <td className="py-2 pr-4">{date(s.lastPractice)}</td>
                    <td className="py-2 pr-4">
                      {s.followUp ? t(`followUpShort.${s.followUp}`) : "—"}
                    </td>
                    <td className="py-2 pr-4">
                      {s.interview ? t(`interviews.${s.interview}`) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollRegion>
        )}
      </section>

      <SurveySummary {...surveys} numbers={numbers} />

      <section aria-labelledby="feedback-title" className="space-y-4">
        <h2 id="feedback-title" className="font-display text-h2">
          {t("feedbackTitle")}
        </h2>
        {!feedback?.length ? (
          <p className="text-ink-muted">{t("noFeedback")}</p>
        ) : (
          <ul className="max-w-practice divide-y divide-line border-y border-line">
            {feedback.map((row) => (
              <li key={row.id} className="space-y-1 py-3">
                <p className="text-supporting text-ink-muted">
                  {[
                    date(row.created_at),
                    row.user_id ? numbers.get(row.user_id) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="whitespace-pre-wrap">{row.message}</p>
              </li>
            ))}
          </ul>
        )}
        <p className="text-supporting">
          <Link
            href="/admin/feedback"
            className="text-accent-ink underline underline-offset-4"
          >
            {t("allFeedback")}
          </Link>
        </p>
      </section>
    </main>
  );
}
