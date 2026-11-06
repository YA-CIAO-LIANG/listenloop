"use client";

import { useFormatter, useTranslations } from "next-intl";
import { ProgressBar } from "./ProgressBar";
import { stagePercent, type Stage } from "./practice-generation";

/**
 * The progress of a long job (preparing a draft, making a practice
 * ready): the current step with its count above a percent bar (e+ 2).
 * The numbers are finished work only, so the bar moves when a batch
 * finishes and never on a timer; Reduce Motion stills its transitions.
 */
export function StageProgress({
  stage,
  className,
}: {
  stage: Stage;
  className?: string;
}) {
  const t = useTranslations("create.stages");
  const format = useFormatter();
  const percent = stagePercent(stage);
  const label =
    stage.stage === "split"
      ? t("split")
      : stage.waitSeconds
        ? t("busy", {
            seconds: stage.waitSeconds,
            done: stage.done,
            total: stage.total,
          })
        : t(stage.stage, { done: stage.done, total: stage.total });
  return (
    <div role="status" className={className}>
      <ProgressBar
        value={percent}
        max={100}
        label={label}
        format="percent"
        valueText={`${label} ${format.number(percent / 100, { style: "percent" })}`}
      />
    </div>
  );
}
