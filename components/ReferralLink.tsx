"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "./Button";

/** The learner's own referral link (D177), with a button that copies it. */
export function ReferralLink({ url }: { url: string }) {
  const t = useTranslations("quota.referral");
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <code
        data-testid="referral-link"
        className="min-w-0 rounded-base border border-line px-3 py-1.5 text-supporting break-all"
      >
        {url}
      </code>
      <Button
        variant="secondary"
        size="sm"
        onClick={() =>
          void navigator.clipboard
            ?.writeText(url)
            .then(() => setCopied(true))
            .catch(() => {})
        }
      >
        {copied ? t("copied") : t("copy")}
      </Button>
      <span role="status" className="sr-only">
        {copied ? t("copied") : ""}
      </span>
    </div>
  );
}
