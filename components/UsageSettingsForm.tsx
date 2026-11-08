"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import {
  saveUsageSettings as saveUsageSettingsAction,
  type UsageSettingsResult,
} from "@/app/admin/usage/actions";
import type { UsageSettings } from "@/lib/usage";
import { Button } from "./Button";

const FIELDS = [
  "adminManualMicros",
  "adminBatchMicros",
  "paidMicros",
  "freeMicros",
  "siteMonthlyMicros",
] as const satisfies readonly (keyof UsageSettings)[];

/**
 * The AI cost limits on /admin/usage (D77): four daily limits and the
 * site's monthly cap, typed in US$, saved together.
 */
export function UsageSettingsForm({
  settings,
  saveUsageSettings = saveUsageSettingsAction,
}: {
  settings: UsageSettings;
  /** Injected in tests; the Server Action otherwise. */
  saveUsageSettings?: typeof saveUsageSettingsAction;
}) {
  const t = useTranslations("adminUsage.settings");
  const router = useRouter();
  const ids = useId();
  const [values, setValues] = useState(() =>
    Object.fromEntries(
      FIELDS.map((key) => [key, String(settings[key] / 1_000_000)]),
    ),
  );
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<UsageSettingsResult | null>(null);

  async function save() {
    setPending(true);
    const outcome = await saveUsageSettings(values).catch(
      (): UsageSettingsResult => ({ ok: false, reason: "failed" }),
    );
    setPending(false);
    setResult(outcome);
    if (outcome.ok) router.refresh();
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className="grid gap-4 split:grid-cols-2">
        {FIELDS.map((key) => (
          <div key={key} className="space-y-1">
            <label htmlFor={`${ids}-${key}`} className="block font-medium">
              {t(`fields.${key}`)}
            </label>
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="text-ink-muted">
                {t("currency")}
              </span>
              <input
                id={`${ids}-${key}`}
                inputMode="decimal"
                value={values[key]}
                disabled={pending}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [key]: event.target.value,
                  }))
                }
                className="h-10 w-32 rounded-base border border-line bg-surface px-3 tabular-nums pointer-coarse:min-h-11"
              />
            </div>
          </div>
        ))}
      </div>
      <p className="text-supporting text-ink-muted">{t("note")}</p>
      <Button type="submit" variant="primary" disabled={pending}>
        {t("save")}
      </Button>
      <div aria-live="polite">
        {result &&
          (result.ok ? (
            <p className="text-supporting text-success">{t("saved")}</p>
          ) : (
            <p role="alert" className="text-supporting text-error">
              {t(`errors.${result.reason}`)}
            </p>
          ))}
      </div>
    </form>
  );
}
