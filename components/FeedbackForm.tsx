"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import {
  submitFeedback as submitFeedbackAction,
  type FeedbackResult,
} from "@/app/feedback/actions";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_MAX_CHARS,
  type FeedbackCategory,
} from "@/lib/feedback";
import { Button } from "./Button";
import { Turnstile } from "./Turnstile";

/**
 * The feedback form (D60): a category and a message. The page it came
 * from (?from=) goes along, so a bug report says where it happened.
 * Render inside <Suspense> (useSearchParams).
 */
export function FeedbackForm({
  submitFeedback = submitFeedbackAction,
}: {
  /** Injected in tests; the Server Action otherwise. */
  submitFeedback?: typeof submitFeedbackAction;
}) {
  const t = useTranslations("feedback");
  const from = useSearchParams().get("from");
  const ids = { category: useId(), message: useId(), hint: useId() };
  const [category, setCategory] = useState<FeedbackCategory>("suggestion");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<FeedbackResult | null>(null);
  const [turnstile, setTurnstile] = useState("");

  async function submit() {
    setPending(true);
    const outcome = await submitFeedback({
      category,
      message,
      page: from,
      turnstile,
    }).catch((): FeedbackResult => ({ ok: false, reason: "failed" }));
    setPending(false);
    setResult(outcome);
    if (outcome.ok) setMessage("");
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label htmlFor={ids.category} className="block font-medium">
          {t("categoryLabel")}
        </label>
        <select
          id={ids.category}
          value={category}
          disabled={pending}
          onChange={(event) =>
            setCategory(event.target.value as FeedbackCategory)
          }
          className="block w-full max-w-md rounded-base border border-line bg-surface px-4 py-3 focus-visible:border-accent"
        >
          {FEEDBACK_CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {t(`categories.${value}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <label htmlFor={ids.message} className="block font-medium">
          {t("messageLabel")}
        </label>
        <p id={ids.hint} className="text-supporting text-ink-muted">
          {t("messageHint")}
        </p>
        <textarea
          id={ids.message}
          rows={6}
          value={message}
          maxLength={FEEDBACK_MAX_CHARS}
          aria-describedby={ids.hint}
          disabled={pending}
          onChange={(event) => setMessage(event.target.value)}
          className="block w-full rounded-base border border-line bg-surface px-4 py-3 focus-visible:border-accent"
        />
      </div>
      <Turnstile action="feedback" onToken={setTurnstile} />
      <Button
        variant="primary"
        onClick={submit}
        disabled={pending || !message.trim()}
      >
        {pending ? t("sending") : t("send")}
      </Button>
      <div aria-live="polite">
        {result &&
          (result.ok ? (
            <p className="text-success">{t("sent")}</p>
          ) : (
            <p role="alert" className="text-error">
              {t(`errors.${result.reason}`)}
            </p>
          ))}
      </div>
    </div>
  );
}
