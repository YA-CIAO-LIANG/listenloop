import type { Metadata } from "next";
import { connection } from "next/server";
import { getFormatter, getTranslations } from "next-intl/server";
import {
  getExperimentReports,
  getPriceOverrides,
  getPriceSurveyAnswers,
} from "@/auth/price-admin";
import { PriceCurves } from "@/components/charts/PriceCurves";
import {
  ClearOverrideButton,
  EndExperimentForm,
  StartExperimentForm,
} from "@/components/PriceExperimentControls";
import { ScrollRegion } from "@/components/ScrollRegion";
import { StatTile } from "@/components/StatTile";
import { PAID_PLANS, PLAN_PRICES, type PaidPlan } from "@/lib/payments/pricing";
import {
  effectivePrices,
  EXPERIMENT_LIMITS,
  revenuePerVisitor,
  suggestedWinner,
  verdict,
} from "@/lib/price-experiments";
import { PRICE_SURVEY, priceCurves, priceRange } from "@/lib/price-survey";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.priceExperiments");
  return { title: t("title") };
}

/**
 * Price experiments and the price survey (D174): the prices people see
 * now, the running experiment's funnel per variant with a plain reading
 * of whether the difference is real, ending it (and applying a price),
 * past experiments, and the Van Westendorp curves.
 */
export default async function AdminPriceExperimentsPage() {
  await connection();
  const [t, tNames, format, reports, overrides, answers] = await Promise.all([
    getTranslations("admin.priceExperiments"),
    getTranslations("plansPage.names"),
    getFormatter(),
    getExperimentReports(),
    getPriceOverrides(),
    getPriceSurveyAnswers(),
  ]);
  const prices = effectivePrices(PLAN_PRICES, overrides);
  const day = { year: "numeric", month: "numeric", day: "numeric" } as const;
  const current = Object.fromEntries(
    PAID_PLANS.map((plan) => [plan, prices[plan].month.amount]),
  ) as Record<PaidPlan, number>;
  const running = reports.find((r) => r.status === "running") ?? null;
  const past = reports.filter((r) => r.status === "ended");
  const nt = (n: number) => `NT$${format.number(Math.round(n))}`;
  const percent = (n: number) =>
    format.number(n, { style: "percent", maximumFractionDigits: 1 });
  const points = priceCurves(answers);
  const range = priceRange(points);
  const control = running?.stats[0];

  return (
    <main className="mx-auto w-full max-w-content flex-1 space-y-12 px-4 py-12 split:px-6">
      <div className="space-y-4">
        <h1 className="font-display text-h1">{t("title")}</h1>
        <p className="max-w-reading text-ink-muted">{t("intro")}</p>
      </div>

      <section aria-labelledby="prices-now" className="space-y-4">
        <h2 id="prices-now" className="font-display text-h2">
          {t("nowTitle")}
        </h2>
        <ul className="space-y-2">
          {PAID_PLANS.map((plan) => {
            const applied = overrides.some((o) => o.plan === plan);
            return (
              <li key={plan} className="flex flex-wrap items-center gap-3">
                <span className="w-28 font-medium">{tNames(plan)}</span>
                <span className="tabular-nums">
                  {t("perMonth", { price: nt(current[plan]) })}
                </span>
                <span className="text-supporting text-ink-muted">
                  {applied
                    ? t("applied", {
                        price: nt(PLAN_PRICES[plan].month.amount),
                      })
                    : t("default")}
                </span>
                {applied && <ClearOverrideButton plan={plan} />}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="running" className="space-y-6">
        <h2 id="running" className="font-display text-h2">
          {t("runningTitle")}
        </h2>
        {running && control ? (
          <>
            <p className="max-w-reading">
              {t("runningLine", {
                plan: tNames(running.plan),
                date: format.dateTime(new Date(running.createdAt), {
                  year: "numeric",
                  month: "numeric",
                  day: "numeric",
                }),
              })}
            </p>
            <ScrollRegion label={t("tableLabel")}>
              <table className="w-full min-w-160 text-left text-supporting">
                <caption className="sr-only">{t("tableLabel")}</caption>
                <thead>
                  <tr className="border-b border-line">
                    {(
                      [
                        "variant",
                        "price",
                        "visitors",
                        "subscribe",
                        "waitlist",
                        "revenue",
                        "reading",
                      ] as const
                    ).map((col) => (
                      <th
                        key={col}
                        scope="col"
                        className="py-2 pr-4 font-medium"
                      >
                        {t(`cols.${col}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {running.stats.map((s, i) => {
                    const v = i === 0 ? null : verdict(control, s);
                    return (
                      <tr key={s.key} className="border-b border-line">
                        <th scope="row" className="py-2 pr-4 font-normal">
                          {i === 0 ? t("control") : t("variant", { n: i + 1 })}
                        </th>
                        <td className="py-2 pr-4 tabular-nums">
                          {nt(s.monthly)}
                        </td>
                        <td className="py-2 pr-4 tabular-nums">
                          {format.number(s.visitors)}
                        </td>
                        <td className="py-2 pr-4 tabular-nums">
                          {format.number(s.subscribers)} (
                          {percent(s.subscribeRate)})
                        </td>
                        <td className="py-2 pr-4 tabular-nums">
                          {format.number(s.waitlist)} ({percent(s.waitlistRate)}
                          )
                        </td>
                        <td className="py-2 pr-4 tabular-nums">
                          {nt(revenuePerVisitor(s))}
                        </td>
                        <td className="py-2 pr-4">
                          {v === null
                            ? "—"
                            : v.kind === "too-early"
                              ? t("readings.tooEarly", { n: v.needed })
                              : v.kind === "no-difference"
                                ? t("readings.noDifference", {
                                    p: v.p === null ? "—" : v.p.toFixed(2),
                                  })
                                : t("readings.significant", {
                                    p: v.p < 0.001 ? "< 0.001" : v.p.toFixed(3),
                                    better:
                                      v.better === s.key
                                        ? t("variant", { n: i + 1 })
                                        : t("control"),
                                  })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ScrollRegion>
            <div className="max-w-reading space-y-2 text-supporting text-ink-muted">
              <p>
                {t("howToRead", {
                  min: EXPERIMENT_LIMITS.minVisitorsPerVariant,
                })}
              </p>
              <p>{t("revenueNote")}</p>
            </div>
            <EndExperimentForm
              id={running.id}
              variants={running.variants}
              suggested={suggestedWinner(running.stats)}
            />
          </>
        ) : (
          <>
            <p className="max-w-reading text-ink-muted">{t("none")}</p>
            <StartExperimentForm
              current={current}
              names={
                Object.fromEntries(
                  PAID_PLANS.map((plan) => [plan, tNames(plan)]),
                ) as Record<PaidPlan, string>
              }
            />
          </>
        )}
      </section>

      {past.length > 0 && (
        <section aria-labelledby="past" className="space-y-4">
          <h2 id="past" className="font-display text-h2">
            {t("pastTitle")}
          </h2>
          <ul className="space-y-2">
            {past.map((r) => {
              const winner = r.variants.find((v) => v.key === r.winner);
              return (
                <li key={r.id}>
                  {t("pastLine", {
                    // Dates tell runs of the same prices apart (D174).
                    from: format.dateTime(new Date(r.createdAt), day),
                    to: r.endedAt
                      ? format.dateTime(new Date(r.endedAt), day)
                      : "—",
                    plan: tNames(r.plan),
                    prices: r.variants.map((v) => nt(v.monthly)).join("／"),
                    visitors: r.stats.reduce((n, s) => n + s.visitors, 0),
                    result: winner
                      ? t("pastApplied", { price: nt(winner.monthly) })
                      : t("pastNone"),
                  })}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="survey" className="space-y-6">
        <h2 id="survey" className="font-display text-h2">
          {t("surveyTitle")}
        </h2>
        <p className="max-w-reading text-ink-muted">{t("surveyIntro")}</p>
        <dl className="grid grid-cols-2 gap-4 wide:grid-cols-4">
          <StatTile
            label={t("survey.responses")}
            value={format.number(answers.length)}
            note={
              answers.length < PRICE_SURVEY.minResponses
                ? t("survey.few", { n: PRICE_SURVEY.minResponses })
                : undefined
            }
          />
          <StatTile
            label={t("survey.range")}
            value={
              range.low !== null && range.high !== null
                ? `${nt(range.low)}–${nt(range.high)}`
                : "—"
            }
          />
          <StatTile
            label={t("survey.optimal")}
            value={range.optimal !== null ? nt(range.optimal) : "—"}
          />
          <StatTile
            label={t("survey.indifference")}
            value={range.indifference !== null ? nt(range.indifference) : "—"}
          />
        </dl>
        <PriceCurves
          points={points}
          formatPrice={nt}
          labels={{
            tooCheap: t("survey.curves.tooCheap"),
            bargain: t("survey.curves.bargain"),
            expensive: t("survey.curves.expensive"),
            tooExpensive: t("survey.curves.tooExpensive"),
          }}
        />
        <p className="max-w-reading text-supporting text-ink-muted">
          {t("survey.howToRead")}
        </p>
      </section>
    </main>
  );
}
