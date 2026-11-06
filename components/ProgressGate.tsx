"use client";

import { useTranslations } from "next-intl";
import { Suspense, type ReactNode } from "react";
import { SignInButton } from "./AccountMenu";
import { useProgressVisible } from "./StoresProvider";

/**
 * Shows progress (today's tasks, the calendar, the progress page) only to
 * a signed-in learner; signed out, a card asks to sign in instead (D2,
 * revised 2026-11-06). Practicing itself stays open: what's done signed
 * out joins the account at sign-in (D3).
 */
export function ProgressGate({
  place,
  className = "",
  children,
}: {
  /** Which wording to use. */
  place: "home" | "practices";
  /** Spacing for the sign-in card. */
  className?: string;
  children: ReactNode;
}) {
  const t = useTranslations("progressGate");
  if (useProgressVisible()) return children;
  return (
    <section
      aria-labelledby={`progress-gate-${place}`}
      className={`rounded-base border border-line bg-surface p-6 ${className}`}
    >
      <h2 id={`progress-gate-${place}`} className="font-display text-h3">
        {t(`${place}.title`)}
      </h2>
      <p className="mt-2 max-w-reading text-ink-muted">{t(`${place}.body`)}</p>
      <p className="mt-2 max-w-reading text-supporting text-ink-muted">
        {t("deviceNote")}
      </p>
      <div className="mt-4">
        {/* SignInButton reads the URL to come back here: Suspense keeps
            the page renderable on the server. */}
        <Suspense fallback={null}>
          <SignInButton variant="primary" size="md" />
        </Suspense>
      </div>
    </section>
  );
}
