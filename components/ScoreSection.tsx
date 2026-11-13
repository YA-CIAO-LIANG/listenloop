"use client";

import { settingsChanged } from "@/lib/personal-settings";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";
import { recordIntent } from "@/app/intent-actions";
import {
  ACCENT_STORAGE_KEY,
  ACCENT_UNLOCK_PRICE,
  ACCENTS,
  accentAttribute,
  DEFAULT_ACCENT,
  isAccentId,
  isUnlocked,
  nextUnlock,
  type AccentId,
} from "@/lib/accents";
import type { Activity } from "@/lib/activity";
import type { LocalDate } from "@/lib/dates";
import { formatPrice } from "@/lib/payments/pricing";
import { withThemeTransition } from "@/lib/theme-transition";
import type { Progress } from "@/lib/progress";
import { scoreEntries, totalScore, type ScoreEntry } from "@/lib/score-points";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { StatTile } from "./StatTile";

/** How many days of score history to list. */
const HISTORY_DAYS = 14;

// The chosen color, remembered in this browser (D93); the server renders
// the default.
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function readAccent(): AccentId {
  try {
    const saved = localStorage.getItem(ACCENT_STORAGE_KEY);
    return isAccentId(saved) ? saved : DEFAULT_ACCENT;
  } catch {
    return DEFAULT_ACCENT;
  }
}
function applyAccent(id: AccentId) {
  try {
    localStorage.setItem(ACCENT_STORAGE_KEY, id);
    settingsChanged();
  } catch {
    // Not remembered; it still changes on this page.
  }
  const attribute = accentAttribute(id);
  withThemeTransition(() => {
    if (attribute)
      document.documentElement.setAttribute("data-accent", attribute);
    else document.documentElement.removeAttribute("data-accent");
  });
  listeners.forEach((listener) => listener());
}

/**
 * Practice score and accent colors (D93), on the stats page: the score
 * from every finished day, perfect sentences, and streaks; the colors it
 * unlocks; and a "unlock forever" button for each locked color, which is
 * a fake door (it records the interest; nothing is sold yet).
 */
export function ScoreSection({
  progresses,
  activity,
  titleOf,
}: {
  progresses: readonly Progress[];
  activity: Activity;
  titleOf: (videoId: string) => string;
}) {
  const t = useTranslations("score");
  const tDay = useTranslations("common");
  const format = useFormatter();
  const chosen = useSyncExternalStore(
    subscribe,
    readAccent,
    () => DEFAULT_ACCENT,
  );
  const [offer, setOffer] = useState<AccentId | null>(null);
  const [joined, setJoined] = useState(false);

  const entries = scoreEntries(activity, progresses);
  const score = totalScore(entries);
  const next = nextUnlock(score);
  const price = formatPrice(
    ACCENT_UNLOCK_PRICE.amount,
    ACCENT_UNLOCK_PRICE.currency,
    (value) => format.number(value),
  );
  const day = (date: LocalDate) =>
    format.dateTime(new Date(`${date}T12:00:00Z`), {
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });

  const byDate = new Map<LocalDate, ScoreEntry[]>();
  for (const entry of entries) {
    byDate.set(entry.date, [...(byDate.get(entry.date) ?? []), entry]);
  }
  const recent = [...byDate].reverse().slice(0, HISTORY_DAYS);

  const line = (entry: ScoreEntry) => {
    switch (entry.kind) {
      case "day":
        return t("entryDay", {
          title: titleOf(entry.task.videoId),
          day: tDay("dayN", { day: entry.task.day }),
        });
      case "perfect":
        return t("entryPerfect", { count: entry.count });
      case "streak":
        return t("entryStreak", { days: entry.days });
    }
  };

  function openOffer(id: AccentId) {
    setOffer(id);
    setJoined(false);
    void recordIntent({
      step: "unlock_click",
      item: `accent-${id}`,
      source: "color-unlock",
    });
  }

  function join(id: AccentId) {
    setJoined(true);
    void recordIntent({
      step: "waitlist_join",
      item: `accent-${id}`,
      source: "color-unlock",
    });
  }

  return (
    <section aria-labelledby="score-title" className="space-y-6">
      <h2 id="score-title" className="font-display text-h2">
        {t("title")}
      </h2>
      <p className="max-w-reading text-supporting text-ink-muted">
        {t("rules")}
      </p>
      <dl className="grid grid-cols-2 gap-4 wide:grid-cols-4">
        <StatTile
          label={t("total")}
          value={format.number(score)}
          note={
            next
              ? t("next", {
                  needed: next.needed,
                  color: t(`colors.${next.id}`),
                })
              : t("allOpen")
          }
        />
      </dl>

      <fieldset className="space-y-3">
        <legend className="font-display text-h3">{t("colorsTitle")}</legend>
        <p className="max-w-reading text-supporting text-ink-muted">
          {t("colorsIntro")}
        </p>
        <ul className="grid gap-3 split:grid-cols-2 wide:grid-cols-3">
          {ACCENTS.map((accent) => {
            const open = isUnlocked(accent.id, score);
            const name = t(`colors.${accent.id}`);
            return (
              <li
                key={accent.id}
                className="flex flex-wrap items-center gap-3 rounded-base border border-line surface-card p-3"
              >
                <label
                  className={`flex min-h-11 flex-1 items-center gap-3 ${open ? "cursor-pointer" : ""}`}
                >
                  <input
                    type="radio"
                    name="accent"
                    value={accent.id}
                    checked={chosen === accent.id}
                    disabled={!open}
                    onChange={() => applyAccent(accent.id)}
                    className="size-4 accent-(--ll-accent)"
                  />
                  <span
                    aria-hidden="true"
                    data-accent={accent.id}
                    className="size-6 shrink-0 rounded-base bg-accent"
                  />
                  <span>
                    <span className="block">{name}</span>
                    <span className="block text-metadata text-ink-muted">
                      {open
                        ? t("open")
                        : t("needs", { points: accent.unlockAt - score })}
                    </span>
                  </span>
                </label>
                {!open && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openOffer(accent.id)}
                  >
                    {t("unlockForever", { price })}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </fieldset>

      <div className="space-y-3">
        <h3 className="font-display text-h3">{t("historyTitle")}</h3>
        {recent.length === 0 ? (
          <p className="text-ink-muted">{t("historyEmpty")}</p>
        ) : (
          <ol className="divide-y divide-line">
            {recent.map(([date, list]) => (
              <li key={date} className="py-3">
                <p className="flex justify-between gap-4">
                  <span>{day(date)}</span>
                  <span className="text-success tabular-nums">
                    +{totalScore(list)}
                  </span>
                </p>
                <ul className="mt-1 space-y-0.5 text-supporting text-ink-muted">
                  {list.map((entry, i) => (
                    <li key={i} className="flex justify-between gap-4">
                      <span>{line(entry)}</span>
                      <span className="tabular-nums">+{entry.amount}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </div>

      {offer && (
        <Dialog
          title={t("offerTitle", { color: t(`colors.${offer}`) })}
          onClose={() => setOffer(null)}
        >
          <p>{t("offerBody", { price })}</p>
          {joined ? (
            <p role="status" className="text-success">
              <span aria-hidden="true">✓ </span>
              {t("offerJoined")}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            {!joined && (
              <Button variant="primary" onClick={() => join(offer)}>
                {t("offerJoin")}
              </Button>
            )}
            <Button variant="ghost" onClick={() => setOffer(null)}>
              {t("offerClose")}
            </Button>
          </div>
        </Dialog>
      )}
    </section>
  );
}
