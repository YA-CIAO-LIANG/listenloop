import { useFormatter, useTranslations } from "next-intl";
import {
  averagePerMonth,
  formatPrice,
  YEARLY_MONTHS_FREE,
  type BillingPeriod,
} from "@/lib/payments/pricing";

/**
 * A plan's price, the same everywhere (D128): the biggest number is
 * always the price a month. Yearly billing shows its monthly average big
 * ("NT$124／月") and, under it, the total paid once and the months saved
 * ("年繳 NT$1,490，一次付清，省 2 個月"). Works in Server and Client
 * Components.
 */
export function PlanPrice({
  total,
  period,
  size = "lg",
}: {
  /** What one period costs: a month's price, or a year's. */
  total: number;
  period: BillingPeriod;
  /** lg: a plan card; md: a second price; inline: one line in a table. */
  size?: "lg" | "md" | "inline";
}) {
  const t = useTranslations("plansPage");
  const format = useFormatter();
  const price = (amount: number) =>
    formatPrice(amount, "TWD", (value) => format.number(value));
  const monthly = period === "year" ? averagePerMonth(total) : total;

  if (size === "inline") {
    return (
      <span className="tabular-nums">
        {price(monthly)}
        {t("perMonthSuffix")}
        {period === "year" && (
          <span className="text-ink-muted">
            {" "}
            {t("yearlyShort", { total: price(total) })}
          </span>
        )}
      </span>
    );
  }

  return (
    <div className="space-y-1">
      <p className="tabular-nums">
        <span
          className={`font-display ${size === "lg" ? "text-h2" : "text-h3"}`}
        >
          {price(monthly)}
        </span>
        <span className="text-ink-muted">{t("perMonthSuffix")}</span>
      </p>
      {period === "year" && (
        <p className="text-supporting text-ink-muted tabular-nums">
          {t("yearlyBilled", { total: price(total) })}
          <span className="text-success">
            {t("monthsFree", { months: YEARLY_MONTHS_FREE })}
          </span>
        </p>
      )}
    </div>
  );
}
