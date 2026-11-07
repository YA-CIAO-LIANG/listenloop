import Link from "next/link";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { getAdminSupabase } from "@/auth/admin";
import { StatTile } from "@/components/StatTile";
import { userNumberLabel } from "@/lib/accounts";
import { adminPeriods, shareOf, SUPABASE_FREE } from "@/lib/admin-dashboard";
import {
  AZURE_CREDIT,
  AZURE_SPEECH_FREE_CHARS,
  creditLeftUsd,
  microsToUsd,
} from "@/lib/usage-report";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.overview");
  return { title: t("title") };
}

/**
 * The dashboard's overview (D56): learners, activity, practices, API
 * spend against the Azure credit, free speech characters, and Supabase
 * storage, paid accounts and the paid plan's waiting list (D72).
 * Opening it also prunes logs past their retention (D55).
 */
export default async function AdminOverviewPage() {
  const [t, tUsers, format] = await Promise.all([
    getTranslations("admin.overview"),
    getTranslations("admin.users"),
    getFormatter(),
  ]);
  const admin = getAdminSupabase();
  if (!admin) {
    return (
      <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
        <h1 className="font-display text-h1">{t("title")}</h1>
        <p className="mt-4 text-error">{t("noSecretKey")}</p>
      </main>
    );
  }
  const { dayStart, weekStart, monthStart } = adminPeriods(new Date());
  const [
    { data: overviewRows },
    { data: usageRows },
    { data: waitlist },
    { count: paidAccounts },
  ] = await Promise.all([
    admin.rpc("admin_overview", { day_start: dayStart, week_start: weekStart }),
    admin.rpc("api_usage_totals", {
      month_start: monthStart,
      day_start: dayStart,
    }),
    // The paid plan's waiting list, newest first (D72).
    admin
      .from("waitlist")
      .select("user_id, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("profiles")
      .select("user_id", { count: "exact", head: true })
      .eq("plan", "paid"),
    // Retention (D55); its result doesn't matter here.
    admin.rpc("prune_logs").then(
      () => null,
      () => null,
    ),
  ]);
  const waiting = waitlist ?? [];
  const { data: waitingProfiles } = waiting.length
    ? await admin
        .from("profiles")
        .select("user_id, number")
        .in(
          "user_id",
          waiting.map((row) => row.user_id),
        )
    : { data: [] };
  const numberOf = new Map(
    (waitingProfiles ?? []).map((row) => [row.user_id, row.number]),
  );
  const o = overviewRows?.[0];
  const u = usageRows?.[0];
  const count = (value: number | undefined) => format.number(value ?? 0);
  const usd = (micros: number) =>
    format.number(microsToUsd(micros), {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  const mb = (bytes: number) =>
    format.number(bytes / (1024 * 1024), { maximumFractionDigits: 1 });
  const percent = (share: number) =>
    format.number(share, { style: "percent", maximumFractionDigits: 0 });

  const groups = [
    {
      id: "learners",
      stats: [
        { label: t("users"), value: count(o?.users) },
        { label: t("activeToday"), value: count(o?.active_today) },
        {
          label: t("activeWeek"),
          value: count(o?.active_week),
          note: t("weekNote"),
        },
        {
          label: t("newUsers"),
          value: count(o?.new_users_week),
          note: t("weekNote"),
        },
      ],
    },
    {
      id: "practice",
      stats: [
        {
          label: t("newPractices"),
          value: count(o?.new_practices_week),
          note: t("weekNote"),
        },
        {
          label: t("daysCompleted"),
          value: count(o?.days_completed_week),
          note: t("weekNote"),
        },
      ],
    },
    {
      id: "plans",
      stats: [
        { label: t("paidAccounts"), value: count(paidAccounts ?? 0) },
        { label: t("waitlist"), value: count(waiting.length) },
      ],
    },
    {
      id: "costs",
      stats: [
        { label: t("monthCost"), value: usd(u?.month_micros ?? 0) },
        {
          label: t("credit"),
          value: format.number(creditLeftUsd(u?.azure_micros ?? 0), {
            style: "currency",
            currency: "USD",
          }),
          note: t("creditNote", {
            total: AZURE_CREDIT.usd,
            endsOn: format.dateTime(
              new Date(`${AZURE_CREDIT.endsOn}T00:00:00`),
              { dateStyle: "medium" },
            ),
          }),
        },
        {
          label: t("speech"),
          value: percent(
            shareOf(u?.month_azure_speech_chars ?? 0, AZURE_SPEECH_FREE_CHARS),
          ),
          note: t("speechNote", {
            used: count(u?.month_azure_speech_chars),
            free: count(AZURE_SPEECH_FREE_CHARS),
          }),
        },
      ],
    },
    {
      id: "storage",
      stats: [
        {
          label: t("database"),
          value: percent(
            shareOf(o?.database_bytes ?? 0, SUPABASE_FREE.databaseBytes),
          ),
          note: t("bytesNote", {
            used: mb(o?.database_bytes ?? 0),
            limit: mb(SUPABASE_FREE.databaseBytes),
          }),
        },
        {
          label: t("files"),
          value: percent(
            shareOf(o?.storage_bytes ?? 0, SUPABASE_FREE.storageBytes),
          ),
          note: t("bytesNote", {
            used: mb(o?.storage_bytes ?? 0),
            limit: mb(SUPABASE_FREE.storageBytes),
          }),
        },
      ],
    },
  ] as const;

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">{t("intro")}</p>
      {groups.map((group) => (
        <section key={group.id} className="mt-10" aria-labelledby={group.id}>
          <h2 id={group.id} className="font-display text-h3">
            {t(`groups.${group.id}`)}
          </h2>
          <dl className="mt-4 grid gap-4 split:grid-cols-2 wide:grid-cols-4">
            {group.stats.map((stat) => (
              <StatTile key={stat.label} {...stat} />
            ))}
          </dl>
        </section>
      ))}
      <section className="mt-10" aria-labelledby="waitlist">
        <h2 id="waitlist" className="font-display text-h3">
          {t("waitlistTitle")}
        </h2>
        {waiting.length === 0 ? (
          <p className="mt-4 text-supporting text-ink-muted">
            {t("waitlistEmpty")}
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line border-y border-line text-supporting">
            {waiting.map((row) => {
              const number = numberOf.get(row.user_id);
              return (
                <li
                  key={row.user_id}
                  className="flex flex-wrap justify-between gap-x-4 py-2"
                >
                  {number === undefined ? (
                    <span>{t("waitlistUnknown")}</span>
                  ) : (
                    <Link
                      href={`/admin/users/${number}`}
                      className="text-accent-ink underline underline-offset-4"
                    >
                      {tUsers("userName", {
                        number: userNumberLabel(number),
                      })}
                    </Link>
                  )}
                  <span className="text-ink-muted">
                    {format.dateTime(new Date(row.created_at), {
                      dateStyle: "medium",
                    })}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
