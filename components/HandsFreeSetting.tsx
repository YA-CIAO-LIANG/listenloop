"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { useHandsFree } from "./useHandsFree";

/**
 * The hands-free switch (D125): on the account page, and next to "Start
 * practice" on practice pages.
 */
export function HandsFreeSetting({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("handsFree");
  const id = useId();
  const [on, setOn] = useHandsFree();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="tap flex items-center gap-3">
        <input
          id={id}
          type="checkbox"
          checked={on}
          onChange={(event) => setOn(event.target.checked)}
          aria-describedby={compact ? undefined : `${id}-hint`}
          className="size-4 shrink-0 accent-accent"
        />
        <span>{t("label")}</span>
      </label>
      {!compact && (
        <p id={`${id}-hint`} className="text-supporting text-ink-muted">
          {t("hint")}
        </p>
      )}
    </div>
  );
}
