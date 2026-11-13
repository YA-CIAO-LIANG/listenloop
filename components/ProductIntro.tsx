"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Suspense } from "react";
import { SignInLink } from "./AccountMenu";

const STEPS = ["day1", "days2to6", "day7"] as const;

/**
 * The home page for a signed-out visitor (D70): what the seven-day loop
 * is, in three steps, and a sign-in button for the calendar, today's
 * tasks, and progress across devices. Practicing needs no account.
 */
export function ProductIntro() {
  const t = useTranslations("home.intro");
  return (
    <section
      aria-labelledby="product-intro"
      className="rounded-base border border-line surface-card p-6"
    >
      <h2 id="product-intro" className="font-display text-h2">
        {t("title")}
      </h2>
      <ol className="mt-6 grid gap-6 split:grid-cols-3">
        {STEPS.map((step, i) => (
          <li key={step} className="space-y-1">
            <p className="font-display text-h3">
              <span className="text-accent-ink tabular-nums">{i + 1}</span>{" "}
              {t(`steps.${step}.title`)}
            </p>
            <p className="text-supporting text-ink-muted">
              {t(`steps.${step}.body`)}
            </p>
          </li>
        ))}
      </ol>
      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* SignInLink reads the URL to come back here. */}
        <Suspense fallback={null}>
          <SignInLink variant="primary" size="md" />
        </Suspense>
        <p className="text-supporting text-ink-muted">{t("noAccount")}</p>
      </div>
      <p className="mt-4">
        <Link
          href="/level-test"
          className="tap text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink"
        >
          {t("levelTest")}
          <span aria-hidden="true"> →</span>
        </Link>
      </p>
    </section>
  );
}
