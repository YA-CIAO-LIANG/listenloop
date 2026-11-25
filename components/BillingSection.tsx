import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { setCancelAtPeriodEnd } from "@/app/billing/actions";
import type { Payment, Subscription } from "@/auth/billing";
import { formatPrice, PLAN_PRICES, PRICES } from "@/lib/payments/pricing";
import { planLabel, type PlanNameTranslator } from "@/lib/plan-names";
import { isPayingPlan, planParts, type AccountPlan } from "@/lib/plans";
import { Button } from "./Button";
import { ButtonLink } from "./ButtonLink";
import { PlanPrice } from "./PlanPrice";
import { Tag } from "./Tag";

const linkClassName =
  "text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink";

/**
 * The account's plan and payments (D85): the plan, when it renews or
 * ends, cancelling or renewing again (at the end of the period, never at
 * once), and every payment. A paid plan without a subscription was set
 * by an admin (D72).
 */
export async function BillingSection({
  plan,
  subscription,
  payments,
  canManage,
}: {
  plan: AccountPlan;
  subscription: Subscription | null;
  payments: Payment[];
  /** A payment provider is set up, so cancelling reaches it. */
  canManage: boolean;
}) {
  const [t, tPlans, format] = await Promise.all([
    getTranslations("billing"),
    getTranslations("planNames"),
    getFormatter(),
  ]);
  const tn = tPlans as unknown as PlanNameTranslator;
  const parts = planParts(plan);
  const date = (iso: string) =>
    format.dateTime(new Date(iso), {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Asia/Taipei",
    });
  const money = (amount: number, currency: string = PRICES.month.currency) =>
    formatPrice(amount, currency, (value, currency) =>
      currency
        ? format.number(value, { style: "currency", currency })
        : format.number(value),
    );
  const live = subscription && subscription.status !== "expired";

  return (
    <section
      id="billing"
      aria-labelledby="billing-title"
      className="mt-16 max-w-reading border-t border-line pt-8"
    >
      <h2 id="billing-title" className="font-display text-h2">
        {t("title")}
      </h2>
      <p className="mt-4 text-supporting text-ink-muted">{t("plan")}</p>
      <p className="mt-1 flex flex-wrap items-center gap-2">
        {isPayingPlan(plan) && !live
          ? t("byAdmin", { plan: planLabel(plan, tn) })
          : planLabel(plan, tn)}
        {live && <span>· {t(`interval.${subscription.interval}`)}</span>}
        {subscription?.test && <Tag>{t("test")}</Tag>}
      </p>
      {/* What the plan costs, a month first like everywhere (D128). */}
      {live && isPayingPlan(plan) && (
        <p className="mt-1 text-supporting">
          <PlanPrice
            total={
              PLAN_PRICES[parts?.line ?? "all"][parts?.tier ?? "plus"][
                subscription.interval
              ].amount
            }
            period={subscription.interval}
            size="inline"
          />
        </p>
      )}
      {subscription && (
        <div className="mt-4 space-y-4">
          {subscription.status === "past_due" && (
            <p role="alert" className="text-error">
              {t("pastDue")}
            </p>
          )}
          {subscription.status === "expired" ? (
            <p className="text-ink-muted">{t("expired")}</p>
          ) : subscription.cancelAtPeriodEnd ? (
            <p>{t("ends", { date: date(subscription.periodEnd) })}</p>
          ) : (
            <p>{t("renews", { date: date(subscription.periodEnd) })}</p>
          )}
          {live && canManage && (
            <form action={setCancelAtPeriodEnd} className="space-y-2">
              <input
                type="hidden"
                name="cancel"
                value={subscription.cancelAtPeriodEnd ? "0" : "1"}
              />
              <Button type="submit">
                {subscription.cancelAtPeriodEnd ? t("resume") : t("cancel")}
              </Button>
              {!subscription.cancelAtPeriodEnd && (
                <p className="text-supporting text-ink-muted">
                  {t("cancelHint")}
                </p>
              )}
            </form>
          )}
        </div>
      )}
      {plan === "free" && !live && (
        <div className="mt-4">
          <ButtonLink href="/pricing">{t("upgrade")}</ButtonLink>
        </div>
      )}

      <h3 className="mt-8 font-display text-h3">{t("history")}</h3>
      {payments.length === 0 ? (
        <p className="mt-2 text-ink-muted">{t("historyEmpty")}</p>
      ) : (
        <table className="mt-2 w-full text-left text-supporting">
          <thead className="text-ink-muted">
            <tr>
              <th scope="col" className="py-2 font-normal">
                {t("date")}
              </th>
              <th scope="col" className="py-2 font-normal">
                {t("amountLabel")}
              </th>
              <th scope="col" className="py-2 font-normal">
                {t("status")}
              </th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id} className="border-t border-line">
                <td className="py-2">{date(payment.createdAt)}</td>
                <td className="py-2 tabular-nums">
                  {money(payment.amount, payment.currency)}
                </td>
                <td className="py-2">
                  {t(`statuses.${payment.status}`)}
                  {payment.test && ` · ${t("test")}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-4 text-supporting">
        <Link href="/refund" className={linkClassName}>
          {t("refundPolicy")}
        </Link>
      </p>
    </section>
  );
}
