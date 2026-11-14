"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { saveConsent } from "@/app/consent-actions";
import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE,
  effectiveConsent,
  isPracticePath,
  isRecordedPath,
  parseConsent,
  type Consent,
} from "@/lib/analytics-consent";
import { Button } from "./Button";

/** Asks to show the choice again (the footer's "Cookie settings"). */
export const CONSENT_OPEN_EVENT = "ll-consent-open";

const listeners = new Set<() => void>();
function readConsent(): Consent | null {
  try {
    const match = document.cookie.match(
      new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]*)`),
    );
    return parseConsent(match?.[1]);
  } catch {
    return null;
  }
}
function writeConsent(consent: Consent) {
  document.cookie = `${CONSENT_COOKIE}=${consent}; Max-Age=${CONSENT_MAX_AGE}; Path=/; SameSite=Lax${
    location.protocol === "https:" ? "; Secure" : ""
  }`;
  listeners.forEach((listener) => listener());
}

type ClarityWindow = Window & {
  clarity?: ((...args: unknown[]) => void) & { q?: unknown[] };
};

/** Microsoft Clarity's loader (its documented snippet), once. */
function loadClarity(projectId: string) {
  const w = window as ClarityWindow;
  if (w.clarity) return;
  const queue: unknown[] = [];
  w.clarity = Object.assign((...args: unknown[]) => queue.push(args), {
    q: queue,
  });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${encodeURIComponent(projectId)}`;
  document.head.appendChild(script);
  // Analytics only: no advertising use (Clarity's consent API).
  w.clarity("consentv2", {
    ad_Storage: "denied",
    analytics_Storage: "granted",
  });
}

/** This browser's choice, kept up to date. */
function useBrowserConsent(): Consent | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    readConsent,
    () => "denied" as Consent,
  );
}

/**
 * Real-user analytics (D148): a cookie notice the first time; Microsoft
 * Clarity loads only after "Accept analytics cookies", and never when
 * NEXT_PUBLIC_CLARITY_PROJECT_ID isn't set (then nothing shows). Account,
 * admin, and class pages are masked whole; inputs are masked by Clarity.
 * Declining later stops it (the page reloads without it).
 *
 * Once chosen it isn't asked again (D180): signed out, this browser keeps
 * the choice; signed in, the account does too, so another device knows
 * it (`account`: the account's choice, undefined when signed out). The
 * footer's "Cookie settings" and the account page show it again.
 */
export function AnalyticsConsent({
  projectId,
  account,
}: {
  projectId: string | null;
  account?: Consent | null;
}) {
  const t = useTranslations("consent");
  const pathname = usePathname();
  const browser = useBrowserConsent();
  const signedIn = account !== undefined;
  // The account's choice, with what was chosen on this page since.
  const [accountChoice, setAccountChoice] = useState(account ?? null);
  const consent = signedIn ? effectiveConsent(browser, accountChoice) : browser;
  const [reopened, setReopened] = useState(false);
  const copied = useRef<Consent | null>(null);

  // Signed in: this browser follows the account's choice; a choice made
  // here before signing in becomes the account's.
  useEffect(() => {
    if (!projectId || !signedIn) return;
    if (accountChoice && browser !== accountChoice) writeConsent(accountChoice);
    else if (!accountChoice && browser && copied.current !== browser) {
      // Once: until a choice here, the browser's applies (effectiveConsent).
      copied.current = browser;
      void saveConsent(browser);
    }
  }, [projectId, signedIn, accountChoice, browser]);

  useEffect(() => {
    const open = () => setReopened(true);
    window.addEventListener(CONSENT_OPEN_EVENT, open);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, open);
  }, []);

  useEffect(() => {
    if (projectId && consent === "granted") loadClarity(projectId);
  }, [projectId, consent]);

  // Pages with personal details aren't recorded: masked whole.
  useEffect(() => {
    if (!projectId) return;
    const body = document.body;
    if (isRecordedPath(pathname)) body.removeAttribute("data-clarity-mask");
    else body.setAttribute("data-clarity-mask", "True");
  }, [projectId, pathname]);

  if (!projectId || (consent !== null && !reopened)) return null;
  if (!reopened && isPracticePath(pathname)) return null;

  function choose(next: Consent) {
    const was = consent;
    writeConsent(next);
    if (signedIn) {
      setAccountChoice(next);
      void saveConsent(next);
    }
    setReopened(false);
    // Turning it off after it ran: reload so it's gone from this page.
    if (was === "granted" && next === "denied") location.reload();
  }

  return (
    <section
      aria-label={t("label")}
      className="sticky inset-x-0 bottom-0 z-30 border-t border-line bg-surface print:hidden"
    >
      <div className="mx-auto flex max-w-content flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4 split:px-6">
        <p className="min-w-0 flex-1 basis-80 text-supporting">
          {t("text")}{" "}
          <Link
            href="/privacy#analytics"
            className="text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink"
          >
            {t("more")}
          </Link>
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" onClick={() => choose("granted")}>
            {t("accept")}
          </Button>
          <Button variant="secondary" onClick={() => choose("denied")}>
            {t("decline")}
          </Button>
        </div>
      </div>
    </section>
  );
}

/**
 * The account page's analytics cookie setting (D180): what's chosen now,
 * and a button that shows the choice again.
 */
export function ConsentSetting() {
  const t = useTranslations("consent");
  const consent = useBrowserConsent();
  return (
    <div className="space-y-4">
      <p className="text-ink-muted">{t("settingIntro")}</p>
      <p role="status">{t(`current.${consent ?? "none"}`)}</p>
      <Button
        variant="secondary"
        onClick={() => window.dispatchEvent(new Event(CONSENT_OPEN_EVENT))}
      >
        {t("change")}
      </Button>
    </div>
  );
}

/** The footer's "Cookie settings": shows the choice again. */
export function CookieSettingsButton() {
  const t = useTranslations("consent");
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(CONSENT_OPEN_EVENT))}
      className="tap underline-offset-4 hover:text-ink hover:underline"
    >
      {t("settings")}
    </button>
  );
}
