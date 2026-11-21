"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { CYCLE_DAYS, type CycleDay } from "@/lib/cycle";
import { isDevTestMode } from "@/lib/config";
import {
  essayPercent,
  newWritingProgress,
  PASS_TARGETS,
  startWritingWeek,
  writingLock,
  writingStatuses,
  type PassRule,
} from "@/lib/writing/progress";
import { Button } from "../Button";
import { ButtonLink } from "../ButtonLink";
import { Card } from "../Card";
import { useToday } from "../useToday";
import { useWritingData, useWritingProgress } from "./WritingProvider";

/**
 * A prompt's week at a glance (D187): the seven days and what each is,
 * which is open, the week's pass rule (the learner's choice), and past
 * weeks. Day 1 is always open; the others follow ListenLoop's rule.
 */
export function WritingOverview({ promptId }: { promptId: string }) {
  const t = useTranslations("writing");
  const today = useToday();
  const progress = useWritingProgress(promptId);
  const { saveProgress } = useWritingData();
  if (!today || progress === undefined) return null;
  const options = { ignoreDates: isDevTestMode() };
  const statuses = writingStatuses(progress, today, options);

  const setRule = (rule: PassRule) => {
    const base = progress ?? newWritingProgress(promptId, today);
    saveProgress({ ...base, rule, updatedAt: new Date().toISOString() });
  };
  const ruleValue =
    progress?.rule.kind === "target" ? String(progress.rule.percent) : "beat";

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="writing-days" className="flex flex-col gap-3">
        <h2 id="writing-days" className="font-display text-h3">
          {t("overview.days")}
        </h2>
        <ol className="grid gap-2 split:grid-cols-7">
          {CYCLE_DAYS.map((day: CycleDay) => {
            const status = statuses[day - 1];
            const lock = writingLock(progress, day, today, options);
            const label = t(`overview.dayName.${day}`);
            const inner = (
              <>
                <span className="text-supporting text-ink-muted">
                  {t("overview.dayN", { day })}
                </span>
                <span className="font-medium">{label}</span>
                <span className="text-supporting text-ink-muted">
                  {status === "done"
                    ? t("overview.done")
                    : lock
                      ? t(`overview.lock.${lock}`)
                      : t("overview.open")}
                </span>
              </>
            );
            return (
              <li key={day}>
                {status === "locked" ? (
                  <div
                    className="flex h-full flex-col gap-1 rounded-base border border-line p-3 opacity-60"
                    aria-disabled="true"
                  >
                    {inner}
                  </div>
                ) : (
                  <Link
                    href={`/writing/${promptId}/day/${day}`}
                    className={`flex h-full flex-col gap-1 rounded-base border p-3 hover:border-ink-muted ${
                      status === "today" ? "border-accent" : "border-line"
                    }`}
                  >
                    {inner}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
        {progress && progress.status !== "in-progress" ? (
          <Card className="flex flex-wrap items-center justify-between gap-3">
            <p>
              {progress.status === "passed"
                ? t("overview.passed")
                : t("overview.repeat")}
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={() => saveProgress(startWritingWeek(progress, today))}
            >
              {t("overview.again")}
            </Button>
          </Card>
        ) : (
          <div>
            <ButtonLink
              href={`/writing/${promptId}/day/${
                statuses.indexOf("today") === -1
                  ? 1
                  : statuses.indexOf("today") + 1
              }`}
              variant="primary"
              arrow
            >
              {progress ? t("overview.continue") : t("overview.start")}
            </ButtonLink>
          </div>
        )}
      </section>

      <section aria-labelledby="writing-rule" className="flex flex-col gap-2">
        <h2 id="writing-rule" className="font-display text-h3">
          {t("overview.rule")}
        </h2>
        <label className="flex flex-col gap-1 split:max-w-sm">
          <span className="text-supporting text-ink-muted">
            {t("overview.ruleLabel")}
          </span>
          <select
            className="min-h-10 rounded-base border border-line bg-surface px-3 pointer-coarse:min-h-11"
            value={ruleValue}
            disabled={
              progress?.status !== undefined &&
              progress.status !== "in-progress"
            }
            onChange={(e) =>
              setRule(
                e.target.value === "beat"
                  ? { kind: "beat" }
                  : { kind: "target", percent: Number(e.target.value) },
              )
            }
          >
            <option value="beat">{t("overview.ruleBeat")}</option>
            {PASS_TARGETS.map((percent) => (
              <option key={percent} value={percent}>
                {t("overview.ruleTarget", { percent })}
              </option>
            ))}
          </select>
        </label>
      </section>

      {progress && progress.history.length > 0 && (
        <section
          aria-labelledby="writing-history"
          className="flex flex-col gap-2"
        >
          <h2 id="writing-history" className="font-display text-h3">
            {t("overview.history")}
          </h2>
          <ul className="flex flex-col gap-1 text-supporting">
            {progress.history.map((week) => (
              <li key={week.week} className="tabular-nums">
                {t("overview.week", {
                  week: week.week,
                  day1: week.day1,
                  day7: week.day7,
                })}{" "}
                ·{" "}
                {week.passed
                  ? t("overview.weekPassed")
                  : t("overview.weekRepeat")}
              </li>
            ))}
          </ul>
        </section>
      )}
      {progress?.days[1]?.done && (
        <p className="text-supporting text-ink-muted">
          {t("overview.day1Score", {
            score: essayPercent(progress.days[1]) ?? 0,
          })}
        </p>
      )}
    </div>
  );
}
