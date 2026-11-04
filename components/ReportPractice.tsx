"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import {
  reportPractice as reportPracticeAction,
  type ReportResult,
} from "@/app/reports/actions";
import {
  REPORT_LIMITS,
  REPORT_REASONS,
  type ReportReason,
} from "@/lib/moderation";
import { Button } from "./Button";

type ReportPracticeProps = {
  /** "p-<uuid>". */
  practiceId: string;
  signedIn: boolean;
  /** Injected in tests; the Server Action otherwise. */
  report?: typeof reportPracticeAction;
};

type ReportError = Exclude<ReportResult, { ok: true }>["reason"];

/**
 * "Report this practice" on someone else's public practice (D31): a
 * reason (required) and optional details, sent to the admins' review.
 * Signed-out visitors are asked to sign in first.
 */
export function ReportPractice({
  practiceId,
  signedIn,
  report = reportPracticeAction,
}: ReportPracticeProps) {
  const t = useTranslations("report");
  const ids = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ReportError | null>(null);
  const [sent, setSent] = useState(false);
  const tooLong = [...details].length > REPORT_LIMITS.details;

  async function submit() {
    if (!reason || tooLong) return;
    setPending(true);
    setError(null);
    const result = await report(practiceId, reason, details).catch(
      (): ReportResult => ({ ok: false, reason: "failed" }),
    );
    setPending(false);
    if (result.ok) {
      setSent(true);
      setOpen(false);
    } else {
      setError(result.reason);
    }
  }

  if (sent) {
    return (
      <p role="status" className="text-supporting text-success">
        {t("sent")}
      </p>
    );
  }
  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        {t("open")}
      </Button>
    );
  }
  if (!signedIn) {
    return (
      <div className="space-y-3">
        <p className="text-supporting text-ink-muted">{t("signInFirst")}</p>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          {t("cancel")}
        </Button>
      </div>
    );
  }

  return (
    <section
      aria-labelledby={`${ids}-title`}
      className="max-w-practice space-y-4 rounded-base border border-line p-4"
    >
      <h2 id={`${ids}-title`} className="font-display text-h3">
        {t("title")}
      </h2>
      <p className="text-supporting text-ink-muted">{t("intro")}</p>
      <fieldset className="space-y-2" disabled={pending}>
        <legend className="mb-2 font-medium">{t("reasonLegend")}</legend>
        {REPORT_REASONS.map((value) => (
          <label key={value} className="flex items-start gap-2">
            <input
              type="radio"
              name={`${ids}-reason`}
              value={value}
              checked={reason === value}
              onChange={() => setReason(value)}
              className="mt-1 size-4 shrink-0 accent-(--ll-accent)"
            />
            <span>
              {t(`reasons.${value}`)}
              <span className="block text-supporting text-ink-muted">
                {t(`reasonHints.${value}`)}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="space-y-2">
        <label htmlFor={`${ids}-details`} className="block font-medium">
          {t("detailsLabel")}
        </label>
        <textarea
          id={`${ids}-details`}
          rows={3}
          value={details}
          disabled={pending}
          onChange={(event) => setDetails(event.target.value)}
          aria-describedby={`${ids}-count`}
          className="block w-full rounded-base border border-line bg-surface px-4 py-3 focus-visible:border-accent"
        />
        <p
          id={`${ids}-count`}
          className={`text-metadata tabular-nums ${tooLong ? "text-error" : "text-ink-muted"}`}
        >
          {t("detailsCount", {
            count: [...details].length,
            max: REPORT_LIMITS.details,
          })}
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button
          variant="primary"
          size="sm"
          onClick={submit}
          disabled={pending || !reason || tooLong}
        >
          {pending ? t("sending") : t("send")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          {t("cancel")}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-supporting text-error">
          {t(`errors.${error}`)}
        </p>
      )}
    </section>
  );
}
