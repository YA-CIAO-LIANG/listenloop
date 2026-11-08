"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  copyAsOfficial as copyAsOfficialAction,
  type CopyOfficialResult,
} from "@/app/materials/organize-actions";
import { Button } from "./Button";

/**
 * "Copy to official materials" on an admin's own practice (D80): the copy
 * becomes an official draft on /admin/official; this practice stays.
 */
export function OfficialToggle({
  practice,
  copyAsOfficial = copyAsOfficialAction,
}: {
  practice: { id: string; title: string };
  /** Injected in tests; the Server Action otherwise. */
  copyAsOfficial?: typeof copyAsOfficialAction;
}) {
  const t = useTranslations("organize");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<CopyOfficialResult | null>(null);

  async function copy() {
    setPending(true);
    setResult(
      await copyAsOfficial(practice.id).catch((): CopyOfficialResult => ({
        ok: false,
        reason: "failed",
      })),
    );
    setPending(false);
  }

  return (
    <div className="space-y-1">
      <Button
        variant="ghost"
        size="sm"
        aria-label={t("copyOfficialLabel", { title: practice.title })}
        onClick={copy}
        disabled={pending}
      >
        {t("copyOfficial")}
      </Button>
      <div aria-live="polite">
        {result &&
          (result.ok ? (
            <p className="text-supporting text-success">
              {t("copiedOfficial")}{" "}
              <Link
                href="/admin/official"
                className="text-accent-ink underline underline-offset-4"
              >
                {t("openOfficial")}
              </Link>
            </p>
          ) : (
            <p role="alert" className="text-supporting text-error">
              {t(`errors.${result.reason}`)}
            </p>
          ))}
      </div>
    </div>
  );
}
