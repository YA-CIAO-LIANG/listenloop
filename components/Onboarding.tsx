"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { ONBOARDING_COOKIE, rememberDismissed } from "@/lib/notices";
import { Button } from "./Button";
import { ButtonLink } from "./ButtonLink";

/**
 * The first-visit guide on the home page (D61, D62): the seven-day loop
 * in three steps and a recommended place to start. The server decides
 * whether it shows (OnboardingStart), so it's in the first HTML; "Skip"
 * remembers it in a cookie.
 */
export function Onboarding({ startHref }: { startHref: string }) {
  const t = useTranslations("onboarding");
  const [skipped, setSkipped] = useState(false);
  if (skipped) return null;
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
        <ButtonLink href="/level-test" variant="secondary">
          {t("levelTest")}
        </ButtonLink>
        <Button
          variant="ghost"
          onClick={() => {
            rememberDismissed(ONBOARDING_COOKIE);
            setSkipped(true);
          }}
        >
          {t("skip")}
        </Button>
      </div>
    </section>
  );
}
