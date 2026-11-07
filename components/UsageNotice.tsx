"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";
import { Button } from "./Button";

/** Remembers on this device that the notice was read (D60). */
export const USAGE_NOTICE_KEY = "ll-usage-notice:v1";

const noSubscription = () => () => {};

/** Whether this device hasn't dismissed the notice yet. */
function readUnread(): boolean {
  try {
    return window.localStorage.getItem(USAGE_NOTICE_KEY) === null;
  } catch {
    return true;
  }
}

/**
 * Shown once per device, under the header (D60): using ListenLoop means
 * agreeing to the terms and privacy policy, and under-18s should use it
 * with a parent's or guardian's consent. "Got it" hides it for good on
 * this device. Nothing shows before the browser has checked, so it never
 * flashes for someone who already dismissed it.
 */
export function UsageNotice() {
  const t = useTranslations("usageNotice");
  const unread = useSyncExternalStore(
    noSubscription,
    readUnread,
    // On the server, and while hydrating: hidden, so it never flashes.
    () => false,
  );
  const [dismissed, setDismissed] = useState(false);

  if (!unread || dismissed) return null;
  return (
    <div className="border-b border-line bg-band print:hidden">
      <div
        role="region"
        aria-label={t("label")}
        className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 split:px-6"
      >
        <p className="text-supporting text-ink-muted">
          {t.rich("text", {
            terms: (chunks) => (
              <Link
                href="/terms"
                className="text-accent-ink underline underline-offset-4"
              >
                {chunks}
              </Link>
            ),
            privacy: (chunks) => (
              <Link
                href="/privacy"
                className="text-accent-ink underline underline-offset-4"
              >
                {chunks}
              </Link>
            ),
          })}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            try {
              window.localStorage.setItem(
                USAGE_NOTICE_KEY,
                new Date().toISOString(),
              );
            } catch {
              // Private mode: it just shows again next time.
            }
            setDismissed(true);
          }}
        >
          {t("ok")}
        </Button>
      </div>
    </div>
  );
}
