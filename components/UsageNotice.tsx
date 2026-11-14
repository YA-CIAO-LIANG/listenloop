"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { dismissUsageNotice } from "@/app/consent-actions";
import { rememberDismissed, USAGE_NOTICE_COOKIE } from "@/lib/notices";
import { Button } from "./Button";

/**
 * Shown under the header until dismissed (D60, D62): using ListenLoop
 * means agreeing to the terms and privacy policy, and under-18s should
 * use it with a parent's or guardian's consent. The layout renders it
 * only while the cookie isn't set, so it's part of the first HTML and
 * never shifts the page.
 *
 * Dismissed once, it stays dismissed (D180): signed out, in this browser;
 * signed in, in the account too, so another device doesn't show it.
 */
export function UsageNotice({ signedIn = false }: { signedIn?: boolean }) {
  const t = useTranslations("usageNotice");
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
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
            rememberDismissed(USAGE_NOTICE_COOKIE);
            if (signedIn) void dismissUsageNotice();
            setDismissed(true);
          }}
        >
          {t("ok")}
        </Button>
      </div>
    </div>
  );
}

/**
 * The account already dismissed the notice on another device (D180): this
 * browser remembers it too, so the server doesn't need to ask next time.
 */
export function RememberUsageNotice() {
  useEffect(() => rememberDismissed(USAGE_NOTICE_COOKIE), []);
  return null;
}

/** The notice's text, kept for reading again on the account page. */
export function UsageNoticeText() {
  const t = useTranslations("usageNotice");
  return (
    <p className="text-ink-muted">
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
  );
}
