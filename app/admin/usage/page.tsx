import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { getAdminSupabase } from "@/auth/admin";
import { diagnoseCreator, getAdminUser } from "@/auth/creator";
import { DAILY_LIMITS } from "@/lib/usage";
import {
  AZURE_CREDIT,
  AZURE_SPEECH_FREE_CHARS,
  creditLeftUsd,
  microsToUsd,
  RECENT_CALLS,
  usagePeriodStarts,
} from "@/lib/usage-report";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminUsage");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * Paid-API usage (D38): the setup check (D47), estimated spend today and
 * this month, the Azure credit left, free speech characters used, and the
 * latest calls. Admins only; the log is read with the secret key, since
 * users can't see it. Without that key only the setup check shows, so it
 * can tell that the key is missing.
 */
export default async function UsagePage() {
  const user = await getAdminUser();
  if (!user) notFound();
  const admin = getAdminSupabase();
  const [t, format] = await Promise.all([
    getTranslations("adminUsage"),
    getFormatter(),
  ]);
  const diagnosis = diagnoseCreator(user);
  const { dayStart, monthStart } = usagePeriodStarts(new Date());
  const [{ data: totalsRows }, { data: calls }] = admin
    ? await Promise.all([
        admin.rpc("api_usage_totals", {
          month_start: monthStart,
          day_start: dayStart,
        }),
        admin
          .from("api_calls")
          .select(
            "id, created_at, provider, operation, error, input_tokens, output_tokens, chars, cost_micros",
          )
          .order("created_at", { ascending: false })
          .limit(RECENT_CALLS),
      ])
    : [{ data: null }, { data: null }];
  const totals = totalsRows?.[0] ?? {
    today_micros: 0,
    today_calls: 0,
    month_micros: 0,
    month_azure_speech_chars: 0,
    azure_micros: 0,
  };

  const usd = (micros: number) =>
    format.number(microsToUsd(micros), {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  const count = (value: number) => format.number(value);
  const date = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: "short", timeStyle: "short" });

  const stats = [
    {
      label: t("today"),
      value: usd(totals.today_micros),
      note: t("todayNote", {
        calls: totals.today_calls,
        limit: usd(DAILY_LIMITS.cost),
      }),
    },
    {
      label: t("month"),
      value: usd(totals.month_micros),
      note: t("monthNote"),
    },
    {
      label: t("credit"),
      value: format.number(creditLeftUsd(totals.azure_micros), {
        style: "currency",
        currency: "USD",
      }),
      note: t("creditNote", {
        spent: usd(totals.azure_micros),
        total: AZURE_CREDIT.usd,
        endsOn: format.dateTime(new Date(`${AZURE_CREDIT.endsOn}T00:00:00`), {
          dateStyle: "medium",
        }),
      }),
    },
    {
      label: t("speech"),
      value: t("speechValue", {
        used: count(totals.month_azure_speech_chars),
        free: count(AZURE_SPEECH_FREE_CHARS),
      }),
      note: t("speechNote", { limit: count(DAILY_LIMITS.speech) }),
    },
  ];

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">{t("intro")}</p>

      <section
        className="rounded mt-8 max-w-practice border border-line bg-surface p-6"
        aria-labelledby="setup-check"
      >
        <h2 id="setup-check" className="font-display text-h3">
          {t("diagnosis.title")}
        </h2>
        <p className="mt-2 text-supporting text-ink-muted">
          {t("diagnosis.intro")}
        </p>
        <p
          className={`mt-4 font-medium ${diagnosis.ready ? "text-success" : "text-error"}`}
        >
          {diagnosis.ready ? t("diagnosis.ready") : t("diagnosis.notReady")}
        </p>
        <div className="mt-4 space-y-6">
          {diagnosis.groups.map((group) => (
            <section key={group.id} aria-labelledby={`setup-${group.id}`}>
              <h3
                id={`setup-${group.id}`}
                className="text-metadata tracking-widest text-ink-muted uppercase"
              >
                {t(`diagnosis.groups.${group.id}`, {
                  vendor: t(`diagnosis.vendors.${group.vendor ?? "unknown"}`),
                })}
              </h3>
              <ul className="mt-2 divide-y divide-line border-y border-line text-supporting">
                {group.checks.map((check) => (
                  <li
                    key={check.id}
                    className="flex items-baseline justify-between gap-4 py-2"
                  >
                    <span className="break-words">
                      {t(
                        `diagnosis.checks.${check.id}` as "diagnosis.checks.admin",
                      )}
                    </span>
                    <span
                      className={`shrink-0 font-medium ${check.ok ? "text-success" : "text-error"}`}
                    >
                      <span aria-hidden="true">{check.ok ? "✓ " : "✗ "}</span>
                      {check.ok ? t("diagnosis.pass") : t("diagnosis.fail")}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>

      <dl className="mt-8 grid gap-4 split:grid-cols-2">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded border border-line bg-surface p-4"
          >
            <dt className="text-metadata tracking-widest text-ink-muted uppercase">
              {stat.label}
            </dt>
            <dd className="mt-2 font-display text-h2 tabular-nums">
              {stat.value}
            </dd>
            <dd className="mt-1 text-supporting text-ink-muted">{stat.note}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-12">
        <h2 className="font-display text-h2">
          {t("recentTitle", { count: RECENT_CALLS })}
        </h2>
        {!calls?.length ? (
          <p className="mt-4 text-ink-muted">{t("noCalls")}</p>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[40rem] border-y border-line text-supporting">
              <thead className="text-left text-ink-muted">
                <tr className="border-b border-line">
                  <th scope="col" className="py-2 pr-4 font-normal">
                    {t("columns.time")}
                  </th>
                  <th scope="col" className="py-2 pr-4 font-normal">
                    {t("columns.operation")}
                  </th>
                  <th scope="col" className="py-2 pr-4 font-normal">
                    {t("columns.provider")}
                  </th>
                  <th scope="col" className="py-2 pr-4 text-right font-normal">
                    {t("columns.tokens")}
                  </th>
                  <th scope="col" className="py-2 pr-4 text-right font-normal">
                    {t("columns.chars")}
                  </th>
                  <th scope="col" className="py-2 pr-4 text-right font-normal">
                    {t("columns.cost")}
                  </th>
                  <th scope="col" className="py-2 font-normal">
                    {t("columns.status")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line tabular-nums">
                {calls.map((call) => (
                  <tr key={call.id}>
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {date(call.created_at)}
                    </td>
                    <td className="py-2 pr-4">{call.operation}</td>
                    <td className="py-2 pr-4 break-all">{call.provider}</td>
                    <td className="py-2 pr-4 text-right whitespace-nowrap">
                      {t("tokens", {
                        input: count(call.input_tokens),
                        output: count(call.output_tokens),
                      })}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      {count(call.chars)}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      {usd(call.cost_micros)}
                    </td>
                    <td
                      className={
                        call.error ? "py-2 text-error" : "py-2 text-success"
                      }
                    >
                      {call.error
                        ? t("failed", { reason: call.error })
                        : t("ok")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
