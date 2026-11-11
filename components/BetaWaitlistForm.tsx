"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { joinBetaWaitlist, type BetaWaitlistResult } from "@/app/beta/actions";
import { PURPOSE_MAX } from "@/lib/beta";
import { Button } from "./Button";

const fieldClassName =
  "block w-full rounded-base border border-line bg-surface px-4 py-3 focus-visible:border-accent";

/** The Beta waiting list (D132): an email and what it's for. */
export function BetaWaitlistForm({
  join = joinBetaWaitlist,
}: {
  /** Injected in tests; the Server Action otherwise. */
  join?: typeof joinBetaWaitlist;
}) {
  const t = useTranslations("beta.waitlist");
  const ids = { email: useId(), purpose: useId(), hint: useId() };
  const [email, setEmail] = useState("");
  const [purpose, setPurpose] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<BetaWaitlistResult | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setResult(
      await join({ email, purpose }).catch((): BetaWaitlistResult => ({
        ok: false,
        reason: "failed",
      })),
    );
    setPending(false);
  }

  if (result?.ok) {
    return (
      <p role="status" className="text-success">
        <span aria-hidden="true">✓ </span>
        {t("joined")}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor={ids.email} className="block font-medium">
          {t("email")}
        </label>
        <input
          id={ids.email}
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={fieldClassName}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor={ids.purpose} className="block font-medium">
          {t("purpose")}
        </label>
        <p id={ids.hint} className="text-supporting text-ink-muted">
          {t("purposeHint")}
        </p>
        <textarea
          id={ids.purpose}
          aria-describedby={ids.hint}
          rows={3}
          maxLength={PURPOSE_MAX}
          value={purpose}
          onChange={(event) => setPurpose(event.target.value)}
          className={`${fieldClassName} resize-y`}
        />
      </div>
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? t("joining") : t("join")}
      </Button>
      {result && !result.ok && (
        <p role="alert" className="text-supporting text-error">
          {t(`errors.${result.reason}`)}
        </p>
      )}
    </form>
  );
}
