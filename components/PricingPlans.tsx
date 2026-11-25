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
  DEFAULT_LINE,
  DEFAULT_PERIOD,
  PLAN_PRICES,
  POPULAR_PLAN,
  REFUND_DAYS,
  YEARLY_MONTHS_FREE,
  type BillingPeriod,
} from "@/lib/payments/pricing";
import { planLabel, type PlanNameTranslator } from "@/lib/plan-names";
import {
  accountPlanFor,
  lineHasListening,
  lineHasWriting,
  PLAN_LINES,
  PLAN_TIERS,
  PLANS,
  type PlanLimits,
  type PlanLine,
  type PlanTier,
} from "@/lib/plans";
import type { PlanPrices } from "@/lib/price-experiments";
import {
  bundleSaving,
  chatSessions,
  perDay,
  proUnitSaving,
  shortTexts,
  studentDiscount,
} from "@/lib/pricing-display";
import type { StudentStatus } from "@/lib/student";
import { WORDS_PER_MINUTE } from "@/lib/units";
import { Button } from "./Button";
import { PlanPrice } from "./PlanPrice";
import { ButtonLink } from "./ButtonLink";
import { Dialog } from "./Dialog";
import { SegmentedControl } from "./SegmentedControl";
import { Tag } from "./Tag";

const linkClassName =
  "text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink";

/** A paid plan on the pricing page: a line and a tier (D210). */
export type PricedPlan = { line: PlanLine; tier: PlanTier };

/** The comparison table's rows: what each plan has (D102, D210). */
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
  "chatMessages",
  "backChecks",
] as const;
/** YouTube links are paused (D131): no row for them. */
const FEATURES = ALL_FEATURES.filter(
  (feature) => YOUTUBE_LINK_PRACTICES_ENABLED || feature !== "youtube",
);

const limitsOf = (plan: "free" | PricedPlan): PlanLimits =>
  plan === "free" ? PLANS.free : PLANS[accountPlanFor(plan.line, plan.tier)];

/**
 * Plans and pricing (D102, D105, D210): three lines (listening, writing,
 * or both, "all") in three tiers (student, Plus, Pro), billed monthly or
 * yearly. "All" and yearly are selected first. The big number is always
 * the price a month; yearly shows its total below (D128). Every number
 * beside a price (what "all" saves, the student and Pro savings, the
 * friendly conversions) is computed from the price and plan tables.
 * Paying isn't open yet: "Subscribe" offers the waiting list (a fake
 * door), and every step is recorded (intent_events).
 */
export function PricingPlans({
  signedIn,
  current,
  joined: joinedBefore,
  source,
  open: openAtStart = null,
  initialLine,
  student = null,
  prices = PLAN_PRICES,
  joinWaitlist = joinWaitlistAction,
  record = recordIntent,
}: {
  signedIn: boolean;
  /** The account's plan, to mark it; null signed out or an admin. */
  current: "free" | PricedPlan | null;
  joined: boolean;
  /** Where the visitor came from (?from=). */
  source: IntentSource;
  /** Back from signing in to join: the plan and period they chose. */
  open?: (PricedPlan & { period: BillingPeriod }) | null;
  /** ?line= (an upgrade prompt links to "all", D210). */
  initialLine?: PlanLine;
  /** The signed-in account's student verification (D144); null signed out. */
  student?: StudentStatus | null;
  /** The prices this visitor sees (D174; the code's while paused, D210). */
  prices?: PlanPrices;
  /** Injected in tests; the Server Actions otherwise. */
  joinWaitlist?: typeof joinWaitlistAction;
  record?: typeof recordIntent;
}) {
  const t = useTranslations("plansPage");
  const tn = useTranslations("planNames") as unknown as PlanNameTranslator;
  const format = useFormatter();
  const name = (plan: PricedPlan) =>
    planLabel(accountPlanFor(plan.line, plan.tier), tn);
  const percent = (n: number) =>
    format.number(n, { style: "percent", maximumFractionDigits: 0 });
  // Whole months a year saves (2 under the ten-months rule, D105).
  const monthsSaved = ({ line, tier }: PricedPlan) => {
    const { month, year } = prices[line][tier];
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
  const [line, setLine] = useState<PlanLine>(
    openAtStart?.line ?? initialLine ?? DEFAULT_LINE,
  );
  const [period, setPeriod] = useState<BillingPeriod>(
    openAtStart?.period ?? DEFAULT_PERIOD,
  );
  const [offer, setOffer] = useState<PricedPlan | null>(
    openAtStart ? { line: openAtStart.line, tier: openAtStart.tier } : null,
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

  function subscribe(plan: PricedPlan) {
    setOffer(plan);
    setFailed(false);
    void record({
      step: "subscribe_click",
      plan: `${plan.line}-${plan.tier}`,
      interval: period,
      source,
    });
  }

  async function join(plan: PricedPlan) {
    setPending(true);
    setFailed(false);
    const result = await joinWaitlist({
      line: plan.line,
      plan: plan.tier,
      period,
      source,
    }).catch((): WaitlistResult => ({ ok: false, reason: "failed" }));
    setPending(false);
    if (result.ok) setJoined(true);
    else setFailed(true);
  }

  const isCurrent = (plan: PricedPlan) =>
    current !== null &&
    current !== "free" &&
    current.line === plan.line &&
    current.tier === plan.tier;
  const isPopular = (plan: PricedPlan) =>
    plan.line === POPULAR_PLAN.line && plan.tier === POPULAR_PLAN.tier;
  const returnTo = (plan: PricedPlan) =>
    `/pricing?line=${plan.line}&plan=${plan.tier}&period=${period}&from=${source}`;

  /** What a plan includes, in plain words with friendly conversions. */
  const allowances = (plan: PricedPlan): string[] => {
    const limits = limitsOf(plan);
    const items: string[] = [];
    if (lineHasListening(plan.line)) {
      const words = limits.wordsPerMonth ?? 0;
      items.push(
        t("allowance.words", {
          words,
          texts: shortTexts(words),
          minutes: Math.round(words / WORDS_PER_MINUTE),
        }),
        t(
          plan.tier === "pro"
            ? "allowance.listeningPro"
            : "allowance.listeningPlus",
        ),
      );
    } else {
      items.push(
        t("allowance.listeningFree", { words: PLANS.free.wordsPerWeek ?? 0 }),
      );
    }
    if (lineHasWriting(plan.line)) {
      const essays = limits.writingReviewsPerWeek ?? 0;
      const sets = limits.backChecksPerWeek ?? 0;
      const messages = limits.chatMessagesPerWeek ?? 0;
      items.push(
        t("allowance.essays", { n: essays, perDay: perDay(essays) }),
        t("allowance.sets", { n: sets, perDay: perDay(sets) }),
        t("allowance.messages", { n: messages, chats: chatSessions(messages) }),
      );
    } else {
      items.push(
        t("allowance.writingFree", {
          n: PLANS.free.writingReviewsPerWeek ?? 0,
        }),
      );
    }
    return items;
  };

  /** The saving shown under a price (D210). */
  const saving = (plan: PricedPlan): string | null => {
    if (plan.line === "all") {
      return t("savings.bundle", {
        amount: format.number(bundleSaving(plan.tier, period)),
      });
    }
    return null;
  };
  const tierNote = (plan: PricedPlan): string | null =>
    plan.tier === "student"
      ? t("savings.student", { percent: percent(studentDiscount(plan.line)) })
      : plan.tier === "pro"
        ? t("savings.pro", { percent: percent(proUnitSaving(plan.line)) })
        : null;

  const cell = (
    plan: "free" | PricedPlan,
    feature: (typeof ALL_FEATURES)[number],
  ): string => {
    const limits = limitsOf(plan);
    const yes = t("yes");
    const no = t("no");
    switch (feature) {
      case "official":
        return yes;
      case "shared":
        return limits.sharedPractices ? yes : t("previewOnly");
      case "create":
        return limits.wordsPerWeek !== null
          ? t("perWeek", { n: limits.wordsPerWeek })
          : limits.practicesTotal !== null
            ? t("trial", { n: limits.practicesTotal })
            : t("perMonth", { n: limits.wordsPerMonth ?? 0 });
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
          : t("essaysPerWeek", { n: limits.writingReviewsPerWeek });
      case "chatMessages":
        return limits.chatMessagesPerWeek === null
          ? t("noLimit")
          : t("messagesPerWeek", { n: limits.chatMessagesPerWeek });
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

  // A verified student sees their plan first (D179).
  const tiers: readonly PlanTier[] = verified
    ? ["student", ...PLAN_TIERS.filter((tier) => tier !== "student")]
    : PLAN_TIERS;
  const lineColumns: ("free" | PricedPlan)[] = [
    "free",
    ...PLAN_TIERS.map((tier) => ({ line, tier })),
  ];
  const columnName = (plan: "free" | PricedPlan) =>
    plan === "free" ? t("names.free") : name(plan);
  const columnKey = (plan: "free" | PricedPlan) =>
    plan === "free" ? "free" : `${plan.line}-${plan.tier}`;

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap gap-x-8 gap-y-4">
        <div className="space-y-2">
          <p aria-hidden="true" className="font-medium">
            {t("lineLegend")}
          </p>
          <SegmentedControl
            legend={t("lineLegend")}
            value={line}
            options={PLAN_LINES.map((value) => ({
              value,
              label: tn(`lines.${value}`),
            }))}
            onChange={setLine}
            optionWidthClassName="min-w-20"
          />
        </div>
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
        </div>
      </div>
      <div className="space-y-1 text-supporting text-ink-muted">
        <p>{t(`lineIntro.${line}`)}</p>
        <p>{t("unlimitedPractice")}</p>
        <p>{t("monthlyReset")}</p>
      </div>

      <ul className="grid gap-6 wide:grid-cols-2">
        <li className="space-y-4 rounded-base border border-line surface-card p-6">
          <h2 className="flex flex-wrap items-center gap-2 font-display text-h3">
            {t("names.free")}
            {current === "free" && <Tag>{t("current")}</Tag>}
          </h2>
          <PlanPrice total={0} period="month" />
          <p className="text-supporting">
            {t("summaries.free", {
              words: PLANS.free.wordsPerWeek ?? 0,
              reviews: PLANS.free.writingReviewsPerWeek ?? 0,
              chat: PLANS.free.chatMessagesPerWeek ?? 0,
              checks: PLANS.free.backChecksPerWeek ?? 0,
            })}
          </p>
        </li>
        {tiers.map((tier) => {
          const plan = { line, tier };
          const total = prices[line][tier][period].amount;
          const bundle = saving(plan);
          const note = tierNote(plan);
          return (
            <li
              key={`${line}-${tier}`}
              data-testid={`plan-${line}-${tier}`}
              className={`space-y-4 rounded-base border bg-surface p-6 ${
                isPopular(plan) ? "border-accent" : "border-line"
              }`}
            >
              <h2 className="flex flex-wrap items-center gap-2 font-display text-h3">
                {name(plan)}
                {isPopular(plan) && <Tag tone="accent">{t("popular")}</Tag>}
                {isCurrent(plan) && <Tag>{t("current")}</Tag>}
                {tier === "student" && verified && !isCurrent(plan) && (
                  <Tag>{t("student.forYou")}</Tag>
                )}
              </h2>
              {/* The price a month is always the big number (D128). */}
              <PlanPrice
                total={total}
                period={period}
                monthsFree={monthsSaved(plan)}
              />
              {(bundle || note) && (
                <p className="text-supporting font-medium text-success">
                  {[bundle, note].filter(Boolean).join(" · ")}
                </p>
              )}
              <ul className="list-disc space-y-1 pl-5 text-supporting">
                {allowances(plan).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              {/* Who can have it, and where this account stands (D144). */}
              {/* Signed out, the "how" below says it all (D179). */}
              {tier === "student" && student && (
                <p
                  data-testid="student-status"
                  className={`text-supporting ${verified ? "text-success" : "text-ink-muted"}`}
                >
                  {verified && <span aria-hidden="true">✓ </span>}
                  {studentLine}
                </p>
              )}
              {/* How to verify, until they are (D179). */}
              {tier === "student" && !verified && (
                <p className="text-supporting text-ink-muted">
                  {t("student.how")}
                </p>
              )}
              <Button
                variant={isPopular(plan) ? "primary" : "secondary"}
                onClick={() => subscribe(plan)}
              >
                {t("subscribe", { plan: name(plan) })}
              </Button>
            </li>
          );
        })}
      </ul>

      <ScrollRegion label={t("overviewTitle")}>
        <table className="w-full min-w-160 text-left text-supporting">
          <caption className="mb-3 text-left font-display text-h3">
            {t("overviewTitle")}
          </caption>
          <thead>
            <tr className="border-b border-line">
              {(
                [
                  "overview.plan",
                  "overview.price",
                  "overview.words",
                  "overview.essays",
                  "overview.sets",
                  "overview.messages",
                ] as const
              ).map((key, i) => (
                <th
                  key={key}
                  scope="col"
                  className={`py-2 ${i === 0 ? "pr-4 font-normal text-ink-muted" : "px-2 font-medium"}`}
                >
                  {t(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PLAN_LINES.flatMap((rowLine) =>
              PLAN_TIERS.map((tier) => {
                const plan = { line: rowLine, tier };
                const limits = limitsOf(plan);
                const listening = lineHasListening(rowLine);
                const writing = lineHasWriting(rowLine);
                const free = (text: string) => (
                  <span className="text-ink-muted">{text}</span>
                );
                return (
                  <tr
                    key={`${rowLine}-${tier}`}
                    className={`border-b border-line tabular-nums ${rowLine === line ? "surface-card" : ""}`}
                  >
                    <th scope="row" className="py-2 pr-4 font-normal">
                      {name(plan)}
                    </th>
                    <td className="px-2 py-2">
                      <PlanPrice
                        total={prices[rowLine][tier][period].amount}
                        period={period}
                        size="inline"
                      />
                    </td>
                    <td className="px-2 py-2">
                      {listening
                        ? t("perMonth", { n: limits.wordsPerMonth ?? 0 })
                        : free(
                            t("overview.freeListening", {
                              words: PLANS.free.wordsPerWeek ?? 0,
                            }),
                          )}
                    </td>
                    <td className="px-2 py-2">
                      {writing
                        ? t("essaysPerWeek", {
                            n: limits.writingReviewsPerWeek ?? 0,
                          })
                        : free(
                            t("overview.freeWriting", {
                              n: PLANS.free.writingReviewsPerWeek ?? 0,
                            }),
                          )}
                    </td>
                    <td className="px-2 py-2">
                      {writing
                        ? t("setsPerWeek", { n: limits.backChecksPerWeek ?? 0 })
                        : free("—")}
                    </td>
                    <td className="px-2 py-2">
                      {writing
                        ? t("messagesPerWeek", {
                            n: limits.chatMessagesPerWeek ?? 0,
                          })
                        : free("—")}
                    </td>
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>
      </ScrollRegion>

      <ScrollRegion label={t("compareTitle", { line: tn(`lines.${line}`) })}>
        <table className="w-full min-w-120 text-left text-supporting">
          <caption className="mb-3 text-left font-display text-h3">
            {t("compareTitle", { line: tn(`lines.${line}`) })}
          </caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="py-2 pr-4 font-normal text-ink-muted">
                {t("feature")}
              </th>
              {lineColumns.map((plan) => (
                <th
                  key={columnKey(plan)}
                  scope="col"
                  className="px-2 py-2 font-medium"
                >
                  {columnName(plan)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-line">
              <th scope="row" className="py-2 pr-4 font-normal">
                {t("priceRow")}
              </th>
              {lineColumns.map((plan) => (
                <td key={columnKey(plan)} className="px-2 py-2">
                  <PlanPrice
                    total={
                      plan === "free"
                        ? 0
                        : prices[plan.line][plan.tier][period].amount
                    }
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
                {lineColumns.map((plan) => (
                  <td key={columnKey(plan)} className="px-2 py-2">
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
            plan: name(offer),
            period: t(`periods.${period}`),
          })}
          onClose={() => setOffer(null)}
        >
          <PlanPrice
            total={prices[offer.line][offer.tier][period].amount}
            period={period}
            size="md"
            monthsFree={monthsSaved(offer)}
          />
          <p>{t("comingSoon")}</p>
          {offer.tier === "student" && !verified ? (
            // Verified by signing in with a school account (D144).
            <>
              <p>{t("student.needVerified")}</p>
              {student && <p className="text-ink-muted">{studentLine}</p>}
              <ButtonLink
                variant="primary"
                href={`/login?next=${encodeURIComponent(returnTo(offer))}`}
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
              href={`/login?next=${encodeURIComponent(returnTo(offer))}`}
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
