import Link from "next/link";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { getAdminSupabase } from "@/auth/admin";
import { SiteActivityChart } from "@/components/SiteActivityChart";
import { StatTile } from "@/components/StatTile";
import { parseActivity } from "@/lib/activity";
import { siteActivity } from "@/lib/analytics";
import { parseProgress } from "@/lib/progress";
import { getUsageSettings } from "@/auth/usage-settings";
import { MONTHLY_WARNING_SHARE } from "@/lib/usage";
import { userNumberLabel } from "@/lib/accounts";
import {
  taiwanToday,
  adminPeriods,
  FREE_LIMITS,
  nearLimits,
  shareOf,
  SUPABASE_FREE,
  type CapacityUse,
} from "@/lib/admin-dashboard";
import { getBetaStatus } from "@/auth/beta";

/** month_audio_ms wants a user; this one is nobody (the site total only). */
const NO_USER = "00000000-0000-0000-0000-000000000000";
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
    { data: activityRows },
    { data: progressRows },
    beta,
    { count: betaWaiting },
    { data: audioRows },
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
    // Everyone's activity logs and progress, for site-wide totals (D75).
    admin
      .from("user_documents")
      .select("data")
      .eq("key", "activity")
      .limit(2000),
    admin.from("progress").select("data").limit(5000),
    // Sign-ups in stages and the free tiers' use (D132, D133).
    getBetaStatus(),
    admin
      .from("beta_waitlist")
      .select("id", { count: "exact", head: true })
      .is("invited_at", null),
    admin.rpc("month_audio_ms", {
      month_start: monthStart,
      target_user: NO_USER,
    }),
    // Retention (D55); its result doesn't matter here.
    admin.rpc("prune_logs").then(
      () => null,
      () => null,
    ),
  ]);
  const site = siteActivity(
    (activityRows ?? []).flatMap((row) => parseActivity(row.data) ?? []),
    (progressRows ?? []).flatMap((row) => parseProgress(row.data) ?? []),
    taiwanToday(new Date()),
  );
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
  // The site's monthly cap (D77): warn from 80%, and say when it's reached.
  const settings = await getUsageSettings(admin);
  const monthShare =
    settings.siteMonthlyMicros > 0
      ? (u?.month_micros ?? 0) / settings.siteMonthlyMicros
      : 0;
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

  // Each free tier's use against its limit (D133), warned from 80%.
  const capacity: (CapacityUse & { label: string; note: string })[] = [
    ...(beta
      ? [
          {
            id: "signups",
            label: t("signups"),
            used: beta.admitted,
            limit: beta.cap,
            note: t(beta.open ? "signupsNote" : "signupsClosed", {
              used: count(beta.admitted),
              cap: count(beta.cap),
            }),
          },
        ]
      : []),
    {
      id: "monthlyUsers",
      label: t("monthlyUsers"),
      used: o?.users ?? 0,
      limit: FREE_LIMITS.supabaseMonthlyUsers,
      note: t("monthlyUsersNote", {
        used: count(o?.users),
        limit: count(FREE_LIMITS.supabaseMonthlyUsers),
      }),
    },
    {
      id: "speech",
      label: t("speech"),
      used: u?.month_azure_speech_chars ?? 0,
      limit: AZURE_SPEECH_FREE_CHARS,
      note: t("speechNote", {
        used: count(u?.month_azure_speech_chars),
        free: count(AZURE_SPEECH_FREE_CHARS),
      }),
    },
    {
      id: "transcribe",
      label: t("transcribe"),
      used: Number(audioRows?.[0]?.site ?? 0) / 1000,
      limit: FREE_LIMITS.transcribeSeconds,
      note: t("transcribeNote", {
        used: format.number(Number(audioRows?.[0]?.site ?? 0) / 60_000, {
          maximumFractionDigits: 1,
        }),
        limit: FREE_LIMITS.transcribeSeconds / 60,
      }),
    },
    {
      id: "aiCost",
      label: t("aiCost"),
      used: u?.month_micros ?? 0,
      limit: settings.siteMonthlyMicros,
      note: t("aiCostNote", {
        used: usd(u?.month_micros ?? 0),
        cap: usd(settings.siteMonthlyMicros),
      }),
    },
    {
      id: "database",
      label: t("database"),
      used: o?.database_bytes ?? 0,
      limit: SUPABASE_FREE.databaseBytes,
      note: t("bytesNote", {
        used: mb(o?.database_bytes ?? 0),
        limit: mb(SUPABASE_FREE.databaseBytes),
      }),
    },
    {
      id: "files",
      label: t("files"),
      used: o?.storage_bytes ?? 0,
      limit: SUPABASE_FREE.storageBytes,
      note: t("bytesNote", {
        used: mb(o?.storage_bytes ?? 0),
        limit: mb(SUPABASE_FREE.storageBytes),
      }),
    },
  ];
  const near = nearLimits(capacity);

  const groups = [
    {
      id: "capacity",
      stats: [
        ...capacity.map((use) => ({
          label: use.label,
          value: percent(shareOf(use.used, use.limit)),
          note: use.note,
        })),
        {
          label: t("betaWaitlist"),
          value: count(betaWaiting ?? 0),
          note: t("betaWaitlistNote"),
        },
      ],
    },
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
      id: "study",
      stats: [
        {
          label: t("averageMinutes"),
          value: format.number(site.averageMinutes, {
            maximumFractionDigits: 1,
          }),
          note: t("averageMinutesNote"),
        },
        {
          label: t("accuracyWeighted"),
          value: site.accuracy ? percent(site.accuracy.weighted) : "—",
          note: site.accuracy
            ? t("accuracyNote", { n: site.accuracy.n })
            : undefined,
        },
        {
          label: t("accuracyRaw"),
          value: site.accuracy ? percent(site.accuracy.raw) : "—",
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
      ],
    },
  ] as const;

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">{t("intro")}</p>
      {near.length > 0 && (
        <div
          role="alert"
          className="mt-6 max-w-reading rounded-base border border-error p-4 text-error"
        >
          <p className="font-medium">{t("nearTitle")}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {near.map((use) => {
              const item = capacity.find((c) => c.id === use.id)!;
              return (
                <li key={use.id}>
                  {t("nearItem", {
                    label: item.label,
                    share: percent(Math.min(use.used / use.limit, 1)),
                  })}
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-supporting">{t("nearHint")}</p>
        </div>
      )}
      {monthShare >= MONTHLY_WARNING_SHARE && (
        <p
          role="alert"
          className="mt-6 max-w-reading rounded-base border border-error p-4 text-error"
        >
          {t(monthShare >= 1 ? "capReached" : "capWarning", {
            share: percent(Math.min(monthShare, 1)),
            cap: usd(settings.siteMonthlyMicros),
          })}{" "}
          <Link href="/admin/usage" className="underline underline-offset-4">
            {t("capLink")}
          </Link>
        </p>
      )}
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
      <div className="mt-10">
        <SiteActivityChart days={site.days} />
      </div>
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
