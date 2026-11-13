"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { AnnouncementLevel } from "@/lib/site-switches";

const STORAGE_KEY = "ll-dismissed-announcements:v1";

function readDismissed(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/**
 * The newest site announcement (D155) under the header, until dismissed
 * on this device. Critical ones can't be dismissed.
 */
export function SiteAnnouncementBanner({
  id,
  level,
  body,
}: {
  id: string;
  level: AnnouncementLevel;
  body: string;
}) {
  const t = useTranslations("ops.banner");
  // Hidden until the browser has checked what was dismissed.
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads localStorage once
    setDismissed(level !== "critical" && readDismissed().includes(id));
  }, [id, level]);
  if (dismissed !== false) return null;
  return (
    <div
      role="region"
      aria-label={t("label")}
      className={`border-b border-line print:hidden ${level === "info" ? "bg-surface" : "bg-error/10"}`}
    >
      <div className="mx-auto flex max-w-content items-start gap-4 px-4 py-3 split:px-6">
        <p className="flex-1 text-supporting whitespace-pre-line">{body}</p>
        {level !== "critical" && (
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.setItem(
                  STORAGE_KEY,
                  JSON.stringify([...readDismissed(), id].slice(-20)),
                );
              } catch {
                // Private mode: hidden for this visit only.
              }
              setDismissed(true);
            }}
            aria-label={t("dismiss")}
            className="-my-1 tap px-2 text-ink-muted hover:text-ink pointer-coarse:min-h-11 pointer-coarse:min-w-11"
          >
            <span aria-hidden="true">×</span>
          </button>
        )}
      </div>
    </div>
  );
}
