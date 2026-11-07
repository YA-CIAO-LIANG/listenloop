"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Button } from "@/components/Button";
import { ButtonLink } from "@/components/ButtonLink";

/**
 * When a page fails to render (D61): what happened in plain words, "Try
 * again", and the way home. The error itself goes to the server's error
 * log (D62); its digest is shown so a report can point at it.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("states.error");
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-16 split:px-6">
      <h1 className="font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">{t("body")}</p>
      {error.digest && (
        <p className="mt-2 text-supporting text-ink-muted">
          {t("code", { code: error.digest })}
        </p>
      )}
      <div className="mt-8 flex flex-wrap gap-3">
        <Button variant="primary" onClick={reset}>
          {t("retry")}
        </Button>
        <ButtonLink href="/" variant="ghost">
          {t("home")}
        </ButtonLink>
      </div>
    </main>
  );
}
