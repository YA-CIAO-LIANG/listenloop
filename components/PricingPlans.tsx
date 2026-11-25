"use client";

import { ScrollRegion } from "./ScrollRegion";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { recordIntent } from "@/app/intent-actions";
import { YOUTUBE_LINK_PRACTICES_ENABLED } from "@/lib/features";
import {
  joinWaitlist as joinWaitlistAction,
  type WaitlistResult,
} from "@/app/plans/actions";
import type { IntentSource } from "@/lib/intent";
import {
  BILLING_PERIODS,
  DEFAULT_PERIOD,
  PAID_PLANS,
  PLAN_PRICES,
  POPULAR_PLAN,
  REFUND_DAYS,
  YEARLY_MONTHS_FREE,
  type BillingPeriod,
  type PaidPlan,
} from "@/lib/payments/pricing";
import { PLANS } from "@/lib/plans";
import type { PlanPrices } from "@/lib/price-experiments";
import type { StudentStatus } from "@/lib/student";
import { Button } from "./Button";
import { PlanPrice } from "./PlanPrice";
import { ButtonLink } from "./ButtonLink";
import { Dialog } from "./Dialog";
import { SegmentedControl } from "./SegmentedControl";
import { Tag } from "./Tag";

const linkClassName =
  "text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink";

/** The account plan behind each paid plan ("paid" is Plus, D102). */
const LIMITS = {
  plus: PLANS.paid,
  pro: PLANS.pro,
  // Plus at a student price (D144), its own AI allowances (D207).
  student: PLANS.student,
} as const;

/**
 * A plan's AI writing allowances for its summary (D207), from PLANS so
 * the words can't drift from the limits.
 */
const writingAllowances = (limits: (typeof PLANS)[keyof typeof PLANS]) => ({
  reviews: limits.writingReviewsPerWeek ?? 0,
  chat: limits.chatMinutesPerWeek ?? 0,
  checks: limits.backChecksPerWeek ?? 0,
});

/** The comparison table's rows: what each plan has (D102). */
const ALL_FEATURES = [
  "official",
  "shared",
  "create",
  "longest",
  "upload",
  "youtube",
  "speed",
  "stats",
  "rules",
  "priority",
  "batchPdf",
  // WritingLoop (D187, D188).
  "writing",
  "writingReviews",
  "writingWords",
  "chatMinutes",
  "backChecks",
] as const;
/** YouTube links are paused (D131): no row for them. */
const FEATURES = ALL_FEATURES.filter(
  (feature) => YOUTUBE_LINK_PRACTICES_ENABLED || feature !== "youtube",
);

/**
 * Plans and pricing (D102, D105): Free, Plus, and Pro, billed monthly or
 * yearly (the default). A yearly price is 10 × the monthly one, shown
 * with "2 months free" and its average a month, never as a percentage.
 * Paying isn't open yet: "Subscribe" says so and offers the waiting list
 * (a fake door). Every step is recorded (intent_events) for the admin's
 * interest page.
 */
export function PricingPlans({
  signedIn,
  current,
  joined: joinedBefore,
  source,
  open: openAtStart = null,
  student = null,
  prices = PLAN_PRICES,
  joinWaitlist = joinWaitlistAction,
  record = recordIntent,
}: {
  signedIn: boolean;
  /** The account's plan, to mark it. */
  current: "free" | PaidPlan | null;
  joined: boolean;
  /** Where the visitor came from (?from=). */
  source: IntentSource;
  /** Back from signing in to join: the plan and period they chose. */
  open?: { plan: PaidPlan; period: BillingPeriod } | null;
  /** The signed-in account's student verification (D144); null signed out. */
  student?: StudentStatus | null;
  /**
   * The prices this visitor sees (D174): the code's, an applied price, or
   * their price experiment's variant (auth/prices.ts).
   */
  prices?: PlanPrices;
  /** Injected in tests; the Server Actions otherwise. */
  joinWaitlist?: typeof joinWaitlistAction;
  record?: typeof recordIntent;
}) {
  const t = useTranslations("plansPage");
  const format = useFormatter();
  // Whole months a year saves (2 under the ten-months rule, D105).
  const monthsSaved = (plan: PaidPlan) => {
    const { month, year } = prices[plan];
    return Math.floor((month.amount * 12 - year.amount) / month.amount);
  };
  const verified = student?.state === "verified";
  const studentUntil =
    student && student.state !== "none"
      ? format.dateTime(new Date(student.until), {
          year: "numeric",
          month: "numeric",
          day: "numeric",
        })
      : "";
  const studentLine = !student
    ? null
    : student.state === "none"
      ? t("student.none")
      : t(`student.${student.state}`, { until: studentUntil });
  const [period, setPeriod] = useState<BillingPeriod>(
    openAtStart?.period ?? DEFAULT_PERIOD,
  );
  const [offer, setOffer] = useState<PaidPlan | null>(
    openAtStart?.plan ?? null,
  );
  const [joined, setJoined] = useState(joinedBefore);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const viewed = useRef(false);

  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    void record({ step: "pricing_view", source });
  }, [record, source]);

  function choosePeriod(next: BillingPeriod) {
    setPeriod(next);
    void record({ step: "interval_switch", interval: next, source });
  }

  function subscribe(plan: PaidPlan) {
    setOffer(plan);
    setFailed(false);
    void record({ step: "subscribe_click", plan, interval: period, source });
  }

  async function join(plan: PaidPlan) {
    setPending(true);
    setFailed(false);
    const result = await joinWaitlist({ plan, period, source }).catch(
      (): WaitlistResult => ({ ok: false, reason: "failed" }),
    );
    setPending(false);
    if (result.ok) setJoined(true);
    else setFailed(true);
  }

  const cell = (
    plan: "free" | PaidPlan,
    feature: (typeof ALL_FEATURES)[number],
  ): string => {
    const limits = plan === "free" ? PLANS.free : LIMITS[plan];
    const yes = t("yes");
    const no = t("no");
    switch (feature) {
      case "official":
        return yes;
      case "shared":
        return limits.sharedPractices ? yes : t("previewOnly");
      case "create":
        return limits.minutesPerWeek !== null
          ? t("perWeek", { n: limits.minutesPerWeek })
          : limits.practicesTotal !== null
            ? t("trial", { n: limits.practicesTotal })
            : t("perMonth", { n: limits.minutesPerMonth ?? 0 });
      case "longest": {
        const seconds = limits.maxPracticeSeconds;
        if (seconds === null) return t("noLimit");
        return seconds < 60
          ? t("seconds", { n: seconds })
          : t("minutes", { n: seconds / 60 });
      }
      case "upload":
        return limits.uploadAudio
          ? t("uploadSize", { mb: limits.uploadMegabytes ?? 0 })
          : no;
      case "youtube":
        return limits.youtubePractices ? yes : no;
      case "writing":
        return yes;
      case "writingReviews":
        return limits.writingReviewsPerWeek === null
          ? t("noLimit")
          : t("timesPerWeek", { n: limits.writingReviewsPerWeek });
      case "chatMinutes":
        return limits.chatMinutesPerWeek === null
          ? t("noLimit")
          : t("minutesPerWeek", { n: limits.chatMinutesPerWeek });
      case "backChecks":
        return limits.backChecksPerWeek === null
          ? t("noLimit")
          : t("setsPerWeek", { n: limits.backChecksPerWeek });
      case "writingWords":
        return limits.writingWords === null
          ? t("noLimit")
          : t("words", { n: limits.writingWords });
      case "speed":
        return limits.playbackSpeed ? yes : no;
      case "stats":
        return limits.fullStats ? t("statsFull") : t("statsBasic");
      case "rules":
        return limits.customRules ? yes : no;
      case "priority":
        return limits.priority ? yes : no;
      case "batchPdf":
        return limits.batchPdf ? t("soon") : no;
    }
  };

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <p aria-hidden="true" className="font-medium">
          {t("periodLegend")}
        </p>
        <SegmentedControl
          legend={t("periodLegend")}
          value={period}
          options={BILLING_PERIODS.map((value) => ({
            value,
            label:
              value === "year"
                ? `${t("periods.year")} · ${t("monthsFree", { months: YEARLY_MONTHS_FREE })}`
                : t(`periods.${value}`),
          }))}
          onChange={choosePeriod}
          optionWidthClassName="min-w-20"
        />
        <p className="text-supporting text-ink-muted">{t("monthlyReset")}</p>
      </div>

      <ul className="grid gap-6 wide:grid-cols-2">
        <li className="space-y-4 rounded-base border border-line surface-card p-6">
          <h2 className="flex flex-wrap items-center gap-2 font-display text-h3">
            {t("names.free")}
            {current === "free" && <Tag>{t("current")}</Tag>}
          </h2>
          <PlanPrice total={0} period="month" />
          <p className="text-supporting">
            {t("summaries.free", writingAllowances(PLANS.free))}
          </p>
        </li>
        {/* A verified student sees their plan first (D179). */}
        {(verified
          ? (["student", ...PAID_PLANS.filter((p) => p !== "student")] as const)
          : PAID_PLANS
        ).map((plan) => {
          const total = prices[plan][period].amount;
          return (
            <li
              key={plan}
              className={`space-y-4 rounded-base border bg-surface p-6 ${
                plan === POPULAR_PLAN ? "border-accent" : "border-line"
              }`}
            >
              <h2 className="flex flex-wrap items-center gap-2 font-display text-h3">
                {t(`names.${plan}`)}
                {plan === POPULAR_PLAN && (
                  <Tag tone="accent">{t("popular")}</Tag>
                )}
                {current === plan && <Tag>{t("current")}</Tag>}
                {plan === "student" && verified && current !== "student" && (
                  <Tag>{t("student.forYou")}</Tag>
                )}
              </h2>
              {/* The price a month is always the big number (D128). */}
              <PlanPrice
                total={total}
                period={period}
                monthsFree={monthsSaved(plan)}
              />
              <p className="text-supporting">
                {t(`summaries.${plan}`, writingAllowances(LIMITS[plan]))}
              </p>
              {/* Who can have it, and where this account stands (D144). */}
              {/* Signed out, the "how" below says it all (D179). */}
              {plan === "student" && student && (
                <p
                  data-testid="student-status"
                  className={`text-supporting ${verified ? "text-success" : "text-ink-muted"}`}
                >
                  {verified && <span aria-hidden="true">✓ </span>}
                  {studentLine}
                </p>
              )}
              {/* How to verify, until they are (D179). */}
              {plan === "student" && !verified && (
                <p className="text-supporting text-ink-muted">
                  {t("student.how")}
                </p>
              )}
              <Button
                variant={plan === POPULAR_PLAN ? "primary" : "secondary"}
                onClick={() => subscribe(plan)}
              >
                {t("subscribe", { plan: t(`names.${plan}`) })}
              </Button>
            </li>
          );
        })}
      </ul>

      <ScrollRegion label={t("compareTitle")}>
        <table className="w-full min-w-120 text-left text-supporting">
          <caption className="mb-3 text-left font-display text-h3">
            {t("compareTitle")}
          </caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="py-2 pr-4 font-normal text-ink-muted">
                {t("feature")}
              </th>
              {(["free", ...PAID_PLANS] as const).map((plan) => (
                <th key={plan} scope="col" className="px-2 py-2 font-medium">
                  {t(`names.${plan}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-line">
              <th scope="row" className="py-2 pr-4 font-normal">
                {t("priceRow")}
              </th>
              {(["free", ...PAID_PLANS] as const).map((plan) => (
                <td key={plan} className="px-2 py-2">
                  <PlanPrice
                    total={plan === "free" ? 0 : prices[plan][period].amount}
                    period={plan === "free" ? "month" : period}
                    size="inline"
                  />
                </td>
              ))}
            </tr>
            {FEATURES.map((feature) => (
              <tr key={feature} className="border-b border-line">
                <th scope="row" className="py-2 pr-4 font-normal">
                  {t(`features.${feature}`)}
                </th>
                {(["free", ...PAID_PLANS] as const).map((plan) => (
                  <td key={plan} className="px-2 py-2">
                    {cell(plan, feature)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollRegion>

      <div className="space-y-2 text-supporting text-ink-muted">
        <p>
          {t("refund", { days: REFUND_DAYS })}{" "}
          <Link href="/refund" className={linkClassName}>
            {t("refundLink")}
          </Link>
        </p>
      </div>

      {offer && (
        <Dialog
          title={t("offerTitle", {
            plan: t(`names.${offer}`),
            period: t(`periods.${period}`),
          })}
          onClose={() => setOffer(null)}
        >
          <PlanPrice
            total={prices[offer][period].amount}
            period={period}
            size="md"
            monthsFree={monthsSaved(offer)}
          />
          <p>{t("comingSoon")}</p>
          {offer === "student" && !verified ? (
            // Verified by signing in with a school account (D144).
            <>
              <p>{t("student.needVerified")}</p>
              {student && <p className="text-ink-muted">{studentLine}</p>}
              <ButtonLink
                variant="primary"
                href={`/login?next=${encodeURIComponent(
                  `/pricing?plan=student&period=${period}&from=${source}`,
                )}`}
              >
                {t("student.signInSchool")}
              </ButtonLink>
            </>
          ) : joined ? (
            <p role="status" className="text-success">
              <span aria-hidden="true">✓ </span>
              {t("joined")}
            </p>
          ) : signedIn ? (
            <Button
              variant="primary"
              onClick={() => join(offer)}
              disabled={pending}
            >
              {pending ? t("joining") : t("join")}
            </Button>
          ) : (
            <ButtonLink
              variant="primary"
              href={`/login?next=${encodeURIComponent(
                `/pricing?plan=${offer}&period=${period}&from=${source}`,
              )}`}
            >
              {t("signInToJoin")}
            </ButtonLink>
          )}
          {failed && (
            <p role="alert" className="text-supporting text-error">
              {t("joinFailed")}
            </p>
          )}
          <Button variant="ghost" onClick={() => setOffer(null)}>
            {t("close")}
          </Button>
        </Dialog>
      )}
    </div>
  );
}
