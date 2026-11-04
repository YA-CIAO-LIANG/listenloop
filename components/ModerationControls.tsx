"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import {
  dismissReports as dismissReportsAction,
  removePractice as removePracticeAction,
  restorePractice as restorePracticeAction,
} from "@/app/admin/reports/actions";
import { REPORT_REASONS, type ReportReason } from "@/lib/moderation";
import { Button } from "./Button";
import { useOrganizeAction } from "./useOrganizeAction";

type ModerationControlsProps = {
  /** The practice's database id. */
  practiceId: string;
  title: string;
  /** Preselected takedown reason: the most reported one. */
  defaultReason: ReportReason;
  /** Injected in tests; the Server Actions otherwise. */
  removePractice?: typeof removePracticeAction;
  dismissReports?: typeof dismissReportsAction;
};

/** Take down (with a reason the author will see) or dismiss (D31). */
export function ModerationControls({
  practiceId,
  title,
  defaultReason,
  removePractice = removePracticeAction,
  dismissReports = dismissReportsAction,
}: ModerationControlsProps) {
  const t = useTranslations("moderation");
  const tReasons = useTranslations("report.reasons");
  const selectId = useId();
  const [reason, setReason] = useState<ReportReason>(defaultReason);
  const action = useOrganizeAction();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-2">
          <label htmlFor={selectId} className="text-supporting text-ink-muted">
            {t("reasonLabel")}
          </label>
          <select
            id={selectId}
            value={reason}
            disabled={action.pending}
            onChange={(event) => setReason(event.target.value as ReportReason)}
            className="h-8 rounded-base border border-line bg-surface px-2 text-supporting focus-visible:border-accent pointer-coarse:min-h-11"
          >
            {REPORT_REASONS.map((value) => (
              <option key={value} value={value}>
                {tReasons(value)}
              </option>
            ))}
          </select>
        </div>
        <Button
          variant="danger"
          size="sm"
          aria-label={t("removeLabel", { title })}
          disabled={action.pending}
          onClick={() => action.run(() => removePractice(practiceId, reason))}
        >
          {t("remove")}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          aria-label={t("dismissLabel", { title })}
          disabled={action.pending}
          onClick={() => action.run(() => dismissReports(practiceId))}
        >
          {t("dismiss")}
        </Button>
      </div>
      {action.error && (
        <p role="alert" className="text-supporting text-error">
          {t(`errors.${action.error}`)}
        </p>
      )}
    </div>
  );
}

/** Undo a takedown from the review page's "Taken down" list. */
export function RestorePracticeButton({
  practiceId,
  title,
  restorePractice = restorePracticeAction,
}: {
  practiceId: string;
  title: string;
  restorePractice?: typeof restorePracticeAction;
}) {
  const t = useTranslations("moderation");
  const action = useOrganizeAction();
  return (
    <div className="space-y-2">
      <Button
        variant="ghost"
        size="sm"
        aria-label={t("restoreLabel", { title })}
        disabled={action.pending}
        onClick={() => action.run(() => restorePractice(practiceId))}
      >
        {t("restore")}
      </Button>
      {action.error && (
        <p role="alert" className="text-supporting text-error">
          {t(`errors.${action.error}`)}
        </p>
      )}
    </div>
  );
}
