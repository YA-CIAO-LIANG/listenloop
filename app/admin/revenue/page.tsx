import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { getAdminSupabase } from "@/auth/admin";
import { getPaymentProvider, isFakeProvider } from "@/auth/payments";
import { RefundButton, SimulateButtons } from "@/components/RevenueControls";
import { StatTile } from "@/components/StatTile";
import { Tag } from "@/components/Tag";
import { userNumberLabel } from "@/lib/accounts";
import { ADMIN_PAGE_ROWS, adminPeriods } from "@/lib/admin-dashboard";
import { formatPrice, PRICES } from "@/lib/payments/pricing";
import { revenueSummary } from "@/lib/payments/revenue";
import type { SubscriptionStatus } from "@/lib/payments/types";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.revenue");
  return { title: t("title") };
}

const linkClassName =
  "text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink";

/**
 * Revenue (D85): subscribers, monthly recurring revenue, this month's
 * payments and refunds, every subscription and recent payment. Anything
 * from the fake provider is marked "test". Plans are changed by hand on
 * the users page (D72); the waiting list downloads as CSV.
 */
export default async function AdminRevenuePage() {
  const [t, format] = await Promise.all([
    getTranslations("admin.revenue"),
    getFormatter(),
  ]);
  const admin = getAdminSupabase();
  const provider = getPaymentProvider();
  const [{ data: subs }, { data: payments }] = admin
    ? await Promise.all([
        admin
          .from("subscriptions")
          .select(
            "user_id, status, billing_interval, current_period_end, cancel_at_period_end, test",
          )
          .order("updated_at", { ascending: false })
          .limit(ADMIN_PAGE_ROWS),
        admin
          .from("payments")
          .select(
            "id, user_id, amount, currency, status, created_at, refunded_at, test",
          )
          .order("created_at", { ascending: false })
          .limit(ADMIN_PAGE_ROWS),
      ])
    : [{ data: null }, { data: null }];
  const ids = [
    ...new Set([
      ...(subs ?? []).map((s) => s.user_id),
      ...(payments ?? []).map((p) => p.user_id),
    ]),
  ];
  const { data: profiles } =
    admin && ids.length
      ? await admin
          .from("profiles")
          .select("user_id, number")
          .in("user_id", ids)
      : { data: null };
  const numbers = new Map((profiles ?? []).map((p) => [p.user_id, p.number]));
  const who = (id: string) => userNumberLabel(numbers.get(id) ?? null);

  const summary = revenueSummary(
    (subs ?? []).map((s) => ({
      status: s.status as SubscriptionStatus,
      interval: s.billing_interval === "year" ? "year" : "month",
      cancelAtPeriodEnd: s.cancel_at_period_end,
      test: s.test,
    })),
    (payments ?? []).map((p) => ({
      amount: p.amount,
      status: p.status === "refunded" ? "refunded" : "paid",
      createdAt: p.created_at,
      refundedAt: p.refunded_at,
      test: p.test,
    })),
    PRICES,
    adminPeriods(new Date()).monthStart,
  );
  const money = (amount: number, currency: string = PRICES.month.currency) =>
    formatPrice(amount, currency, (value, currency) =>
      currency
        ? format.number(value, { style: "currency", currency })
        : format.number(value),
    );
  const date = (iso: string) =>
    format.dateTime(new Date(iso), {
      dateStyle: "medium",
      timeZone: "Asia/Taipei",
    });
  const fake = isFakeProvider(provider);

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-h1">{t("title")}</h1>
        {(summary.test || fake) && <Tag>{t("testTag")}</Tag>}
      </div>
      <p className="mt-4 max-w-reading text-ink-muted">
        {provider ? t("intro") : t("off")}
      </p>
      <p className="mt-2 text-supporting">
        <Link href="/admin/users" className={linkClassName}>
          {t("manualPlan")}
        </Link>
        {" · "}
        <a href="/admin/waitlist/export" download className={linkClassName}>
          {t("waitlistExport")}
        </a>
      </p>

      <dl className="mt-8 grid gap-4 split:grid-cols-2 wide:grid-cols-4">
        <StatTile
          label={t("stats.subscribers")}
          value={summary.subscribers}
          note={t("stats.cancelling", { n: summary.cancelling })}
        />
        <StatTile
          label={t("stats.mrr")}
          value={money(summary.monthlyRecurring)}
        />
        <StatTile label={t("stats.net")} value={money(summary.netThisMonth)} />
        <StatTile label={t("stats.refunds")} value={summary.refundsThisMonth} />
      </dl>

      <section aria-labelledby="subscribers" className="mt-12">
        <h2 id="subscribers" className="font-display text-h3">
          {t("subscribers")}
        </h2>
        {(subs ?? []).length === 0 ? (
          <p className="mt-2 text-ink-muted">{t("noSubscribers")}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-supporting">
              <thead className="text-ink-muted">
                <tr>
                  {(["user", "interval", "status", "periodEnd"] as const).map(
                    (column) => (
                      <th
                        key={column}
                        scope="col"
                        className="py-2 pr-4 font-normal"
                      >
                        {t(`columns.${column}`)}
                      </th>
                    ),
                  )}
                  {fake && (
                    <th scope="col" className="py-2 font-normal">
                      {t("columns.simulate")}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {(subs ?? []).map((s) => (
                  <tr key={s.user_id} className="border-t border-line">
                    <td className="py-2 pr-4">{who(s.user_id)}</td>
                    <td className="py-2 pr-4">
                      {t(
                        `intervals.${s.billing_interval === "year" ? "year" : "month"}`,
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {t(`statuses.${s.status as SubscriptionStatus}`)}
                      {s.cancel_at_period_end && ` · ${t("cancelling")}`}
                      {s.test && ` · ${t("testTag")}`}
                    </td>
                    <td className="py-2 pr-4">{date(s.current_period_end)}</td>
                    {fake && (
                      <td className="py-2">
                        <SimulateButtons userId={s.user_id} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="payments" className="mt-12">
        <h2 id="payments" className="font-display text-h3">
          {t("payments")}
        </h2>
        {(payments ?? []).length === 0 ? (
          <p className="mt-2 text-ink-muted">{t("noPayments")}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-supporting">
              <thead className="text-ink-muted">
                <tr>
                  {(
                    ["time", "user", "amount", "status", "actions"] as const
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
                {(payments ?? []).map((p) => (
                  <tr key={p.id} className="border-t border-line">
                    <td className="py-2 pr-4">{date(p.created_at)}</td>
                    <td className="py-2 pr-4">{who(p.user_id)}</td>
                    <td className="py-2 pr-4 tabular-nums">
                      {money(p.amount, p.currency)}
                    </td>
                    <td className="py-2 pr-4">
                      {t(
                        `paymentStatuses.${p.status === "refunded" ? "refunded" : "paid"}`,
                      )}
                      {p.test && ` · ${t("testTag")}`}
                    </td>
                    <td className="py-2">
                      {p.status === "paid" && provider && (
                        <RefundButton
                          paymentId={p.id}
                          amount={money(p.amount, p.currency)}
                        />
                      )}
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
