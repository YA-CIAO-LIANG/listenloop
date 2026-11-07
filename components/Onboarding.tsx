"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ButtonLink } from "./ButtonLink";
import { Button } from "./Button";
import { useStores } from "./StoresProvider";

/** Remembers on this device that the guide was skipped (D61). */
export const ONBOARDING_KEY = "ll-onboarding:v1";

const noSubscription = () => () => {};
function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(ONBOARDING_KEY) !== null;
  } catch {
    return false;
  }
}

/**
 * The first-visit guide on the home page (D61): the seven-day loop in
 * three steps and a recommended place to start. Shows until the learner
 * starts a practice or skips it; nothing shows on the server, so it never
 * flashes for someone who doesn't need it.
 */
export function Onboarding({ startHref }: { startHref: string }) {
  const t = useTranslations("onboarding");
  const { progress } = useStores();
  const dismissed = useSyncExternalStore(
    noSubscription,
    readDismissed,
    () => true,
  );
  const [skipped, setSkipped] = useState(false);
  const [practicing, setPracticing] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    progress
      .list()
      .then((all) => !cancelled && setPracticing(all.length > 0))
      .catch(() => !cancelled && setPracticing(false));
    return () => {
      cancelled = true;
    };
  }, [progress]);

  if (dismissed || skipped || practicing !== false) return null;
  return (
    <section
      aria-labelledby="onboarding-title"
      className="rounded-base border border-line bg-surface p-6"
    >
      <h2 id="onboarding-title" className="font-display text-h3">
        {t("title")}
      </h2>
      <ol className="mt-4 grid gap-4 split:grid-cols-3">
        {(["day1", "days2to6", "day7"] as const).map((step) => (
          <li key={step} className="space-y-1">
            <p className="text-metadata tracking-widest text-accent-ink uppercase">
              {t(`steps.${step}.label`)}
            </p>
            <p className="font-medium">{t(`steps.${step}.title`)}</p>
            <p className="text-supporting text-ink-muted">
              {t(`steps.${step}.body`)}
            </p>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-supporting text-ink-muted">{t("note")}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonLink href={startHref} variant="primary" arrow>
          {t("start")}
        </ButtonLink>
        <Button
          variant="ghost"
          onClick={() => {
            try {
              window.localStorage.setItem(
                ONBOARDING_KEY,
                new Date().toISOString(),
              );
            } catch {
              // Private mode: it shows again next time.
            }
            setSkipped(true);
          }}
        >
          {t("skip")}
        </Button>
      </div>
    </section>
  );
}
