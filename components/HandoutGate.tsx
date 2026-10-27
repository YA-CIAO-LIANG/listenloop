"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import { toLocalDate } from "@/lib/dates";
import { createLocalProgressStore } from "@/lib/storage/local-progress-store";
import type { ProgressStore } from "@/lib/storage/progress-store";
import { Button } from "./Button";
import { ButtonLink } from "./ButtonLink";

type HandoutGateProps = {
  videoId: string;
  /** The handout itself; shown once Day 1 is done. */
  children: ReactNode;
  /** Injected in tests; defaults to localStorage. */
  store?: ProgressStore;
};

/**
 * Shows the handout only after the official Day 1 dictation is done, so
 * learners listen before reading the transcript. Progress lives in the
 * browser, so this is a soft gate checked on the client.
 */
export function HandoutGate({ videoId, children, store }: HandoutGateProps) {
  const t = useTranslations("handout");
  const [progressStore] = useState(() => store ?? createLocalProgressStore());
  const [state, setState] = useState<"loading" | "locked" | "open">("loading");

  useEffect(() => {
    let cancelled = false;
    progressStore
      .get(videoId)
      .then((progress) => {
        if (!cancelled) setState(progress?.days[1]?.done ? "open" : "locked");
      })
      .catch(() => {
        if (!cancelled) setState("locked");
      });
    return () => {
      cancelled = true;
    };
  }, [progressStore, videoId]);

  if (state === "loading") {
    return (
      <p role="status" className="text-ink-muted">
        {t("loading")}
      </p>
    );
  }

  if (state === "locked") {
    return (
      <div className="space-y-4">
        <p className="max-w-reading">{t("locked")}</p>
        <ButtonLink href={`/videos/${videoId}/day/1`} variant="primary" arrow>
          {t("goDay1")}
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="space-y-8 print:space-y-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 print:hidden">
        <Button variant="primary" onClick={() => window.print()}>
          {t("print")}
        </Button>
        <span className="text-supporting text-ink-muted">{t("printHint")}</span>
      </div>
      <p className="text-metadata text-ink-muted">
        {t("generated", { date: toLocalDate(new Date()) })}
      </p>
      {children}
    </div>
  );
}
