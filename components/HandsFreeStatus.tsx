"use client";

import { useTranslations } from "next-intl";

export type HandsFreeState =
  "start" | "playing" | "listen" | "recognizing" | "type" | "paused";

/**
 * What hands-free practice is doing now (D125): "Playing", "Say it after
 * me", "Recognizing"… A polite live region, so screen readers hear each
 * change; the line keeps its height when empty.
 */
export function HandsFreeStatus({ state }: { state: HandsFreeState | null }) {
  const t = useTranslations("handsFree.status");
  const active =
    state === "playing" || state === "listen" || state === "recognizing";
  return (
    <p
      aria-live="polite"
      className={`min-h-6 text-supporting ${active ? "font-medium text-accent-ink" : "text-ink-muted"}`}
    >
      {state && (
        <>
          {active && <span aria-hidden="true">● </span>}
          {t(state)}
        </>
      )}
    </p>
  );
}
