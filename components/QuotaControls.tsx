"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import {
  addQuotaOverride as addAction,
  endQuotaOverride as endAction,
  setAiSuspended as suspendAction,
  type QuotaAdminResult,
} from "@/app/admin/users/quota-actions";
import {
  OVERRIDABLE_LIMITS,
  OVERRIDE_MAX_DAYS,
  OVERRIDE_REASON_MAX,
  type OverridableLimit,
} from "@/lib/quota";
import { Button } from "./Button";

const fieldClassName =
  "h-10 rounded-base border border-line bg-surface px-3 focus-visible:border-accent pointer-coarse:min-h-11";

function Message({ result }: { result: QuotaAdminResult | null }) {
  const t = useTranslations("admin.quota");
  if (!result) return null;
  return result.ok ? (
    <p role="status" className="text-supporting text-success">
      {t("saved")}
    </p>
  ) : (
    <p role="alert" className="text-supporting text-error">
      {t(`errors.${result.reason}`)}
    </p>
  );
}

export type OverrideRow = {
  id: string;
  limit: OverridableLimit;
  extra: number;
  expiresAt: string;
  reason: string;
  active: boolean;
  /** Formatted on the server. */
  expires: string;
};

/**
 * One account's quota changes and AI pause (D161): add a change (a limit,
 * how much more or less, for how many days, and why), end one, pause or
 * resume AI with a reason.
 */
export function QuotaControls({
  userId,
  overrides,
  aiSuspended,
  add = addAction,
  end = endAction,
  suspend = suspendAction,
}: {
  userId: string;
  overrides: OverrideRow[];
  /** The reason, when AI is paused; null otherwise. */
  aiSuspended: string | null;
  add?: typeof addAction;
  end?: typeof endAction;
  suspend?: typeof suspendAction;
}) {
  const t = useTranslations("admin.quota");
  const router = useRouter();
  const ids = {
    limit: useId(),
    extra: useId(),
    days: useId(),
    reason: useId(),
    hint: useId(),
    aiReason: useId(),
  };
  const [limit, setLimit] = useState<OverridableLimit>("minutesPerWeek");
  const [extra, setExtra] = useState("5");
  const [days, setDays] = useState("7");
  const [reason, setReason] = useState("");
  const [aiReason, setAiReason] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<QuotaAdminResult | null>(null);

  async function run(action: () => Promise<QuotaAdminResult>) {
    setPending(true);
    const answer = await action().catch((): QuotaAdminResult => ({
      ok: false,
      reason: "failed",
    }));
    setResult(answer);
    setPending(false);
    if (answer.ok) router.refresh();
    return answer.ok;
  }

  return (
    <div className="space-y-8">
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          const ok = await run(() =>
            add({
              userId,
              limit,
              extra: Number(extra),
              days: Number(days),
              reason,
            }),
          );
          if (ok) setReason("");
        }}
      >
        <div className="flex flex-wrap gap-4">
          <div className="space-y-1">
            <label htmlFor={ids.limit} className="block text-supporting">
              {t("limit")}
            </label>
            <select
              id={ids.limit}
              value={limit}
              onChange={(e) => setLimit(e.target.value as OverridableLimit)}
              className={fieldClassName}
            >
              {OVERRIDABLE_LIMITS.map((value) => (
                <option key={value} value={value}>
                  {t(`limits.${value}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor={ids.extra} className="block text-supporting">
              {t("extra")}
            </label>
            <input
              id={ids.extra}
              type="number"
              inputMode="numeric"
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              className={`${fieldClassName} w-28 tabular-nums`}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor={ids.days} className="block text-supporting">
              {t("days")}
            </label>
            <input
              id={ids.days}
              type="number"
              min={1}
              max={OVERRIDE_MAX_DAYS}
              inputMode="numeric"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className={`${fieldClassName} w-24 tabular-nums`}
            />
          </div>
        </div>
        <p id={ids.hint} className="text-supporting text-ink-muted">
          {t("hint", { max: OVERRIDE_MAX_DAYS })}
        </p>
        <div className="space-y-1">
          <label htmlFor={ids.reason} className="block text-supporting">
            {t("reason")}
          </label>
          <input
            id={ids.reason}
            required
            maxLength={OVERRIDE_REASON_MAX}
            aria-describedby={ids.hint}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={`${fieldClassName} w-full`}
          />
        </div>
        <Button type="submit" variant="primary" disabled={pending}>
          {t("add")}
        </Button>
      </form>

      {overrides.length > 0 && (
        <ul className="divide-y divide-line border-y border-line text-supporting">
          {overrides.map((o) => (
            <li
              key={o.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <span>
                {t("row", {
                  limit: t(`limits.${o.limit}`),
                  extra: o.extra > 0 ? `+${o.extra}` : String(o.extra),
                  until: o.expires,
                })}
                <span className="text-ink-muted"> · {o.reason}</span>
                {!o.active && (
                  <span className="text-ink-muted"> · {t("ended")}</span>
                )}
              </span>
              {o.active && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={pending}
                  onClick={() => run(() => end(o.id))}
                >
                  {t("end")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-3">
        <h3 className="font-medium">{t("aiTitle")}</h3>
        {aiSuspended !== null ? (
          <>
            <p className="text-supporting text-error">
              {t("aiPaused", { reason: aiSuspended || "—" })}
            </p>
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => run(() => suspend({ userId, suspended: false }))}
            >
              {t("aiResume")}
            </Button>
          </>
        ) : (
          <form
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault();
              const ok = await run(() =>
                suspend({ userId, suspended: true, reason: aiReason }),
              );
              if (ok) setAiReason("");
            }}
          >
            <div className="space-y-1">
              <label htmlFor={ids.aiReason} className="block text-supporting">
                {t("aiReason")}
              </label>
              <input
                id={ids.aiReason}
                required
                maxLength={OVERRIDE_REASON_MAX}
                value={aiReason}
                onChange={(e) => setAiReason(e.target.value)}
                className={`${fieldClassName} w-full`}
              />
            </div>
            <Button type="submit" variant="secondary" disabled={pending}>
              {t("aiPause")}
            </Button>
          </form>
        )}
      </div>
      <Message result={result} />
    </div>
  );
}
