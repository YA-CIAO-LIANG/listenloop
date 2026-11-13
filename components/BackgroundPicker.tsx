"use client";

import { settingsChanged } from "@/lib/personal-settings";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";
import { recordIntent } from "@/app/intent-actions";
import {
  ACCENT_STORAGE_KEY,
  DEFAULT_ACCENT,
  isAccentId,
  type AccentId,
} from "@/lib/accents";
import {
  BACKGROUND_GROUPS,
  BACKGROUND_STORAGE_KEY,
  BACKGROUND_UNLOCK_PRICE,
  BACKGROUNDS,
  backgroundAttribute,
  DEFAULT_BACKGROUND,
  isBackgroundId,
  isBackgroundOpen,
  nextBackground,
  RECOMMENDED_BACKGROUNDS,
  type Background,
  type BackgroundId,
} from "@/lib/backgrounds";
import { formatPrice } from "@/lib/payments/pricing";
import { scoreEntries, totalScore } from "@/lib/score-points";
import { withThemeTransition } from "@/lib/theme-transition";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { useStores } from "./StoresProvider";
import { ThemePreview } from "./ThemePreview";

// The chosen theme, remembered in this browser (D121); the server
// renders the default, and the <head> script applies the saved one.
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function readSaved(): BackgroundId {
  try {
    const saved = localStorage.getItem(BACKGROUND_STORAGE_KEY);
    return isBackgroundId(saved) ? saved : DEFAULT_BACKGROUND;
  } catch {
    return DEFAULT_BACKGROUND;
  }
}
/** The learner's own accent color (D93), which wins over a theme's. */
function readAccent(): AccentId | null {
  try {
    const saved = localStorage.getItem(ACCENT_STORAGE_KEY);
    return isAccentId(saved) && saved !== DEFAULT_ACCENT ? saved : null;
  } catch {
    return null;
  }
}
const noSubscription = () => () => {};
/** Shows `id` on the whole page (without saving it), fading over. */
function show(id: BackgroundId) {
  const attribute = backgroundAttribute(id);
  withThemeTransition(() => {
    if (attribute) document.documentElement.setAttribute("data-bg", attribute);
    else document.documentElement.removeAttribute("data-bg");
  });
}
function save(id: BackgroundId) {
  try {
    localStorage.setItem(BACKGROUND_STORAGE_KEY, id);
    settingsChanged();
  } catch {
    // Not remembered; it still changes on this page.
  }
  show(id);
  listeners.forEach((listener) => listener());
}

/**
 * Themes (D121, D166) in the account settings: six recommended ones
 * first, then the rest grouped by style. Each is a card with a live
 * miniature of the home page and a practice page in that theme (the
 * learner's current light or dark mode). Open ones (free, or reached by
 * practice score) can be chosen; any one can be previewed on the whole
 * page; the animated ones have an "unlock forever" fake door that records
 * interest. All the cards are one native radio group (arrow keys move
 * between the open ones), and the focused card shows the focus ring.
 */
export function BackgroundPicker() {
  const t = useTranslations("backgrounds");
  const format = useFormatter();
  const { progress, rewards } = useStores();
  const chosen = useSyncExternalStore(
    subscribe,
    readSaved,
    () => DEFAULT_BACKGROUND,
  );
  const accent = useSyncExternalStore(noSubscription, readAccent, () => null);
  const [score, setScore] = useState<number | null>(null);
  const [preview, setPreview] = useState<BackgroundId | null>(null);
  const [offer, setOffer] = useState<BackgroundId | null>(null);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([progress.list(), rewards.getActivity()]).then(
      ([progresses, activity]) => {
        if (!cancelled)
          setScore(totalScore(scoreEntries(activity, progresses)));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [progress, rewards]);

  // Leaving the page ends a preview: back to the saved theme.
  useEffect(() => () => show(readSaved()), []);

  const points = score ?? 0;
  const next = nextBackground(points);
  const price = formatPrice(
    BACKGROUND_UNLOCK_PRICE.amount,
    BACKGROUND_UNLOCK_PRICE.currency,
    (value) => format.number(value),
  );

  function startPreview(id: BackgroundId) {
    setPreview(id);
    show(id);
  }
  function endPreview() {
    setPreview(null);
    show(chosen);
  }
  function choose(id: BackgroundId) {
    setPreview(null);
    save(id);
  }
  function openOffer(id: BackgroundId) {
    setOffer(id);
    setJoined(false);
    void recordIntent({
      step: "unlock_click",
      item: `bg-${id}`,
      source: "background-unlock",
    });
  }
  function join(id: BackgroundId) {
    setJoined(true);
    void recordIntent({
      step: "waitlist_join",
      item: `bg-${id}`,
      source: "background-unlock",
    });
  }

  const sections = [
    {
      key: "recommended",
      title: t("recommended"),
      items: RECOMMENDED_BACKGROUNDS.map((id) =>
        BACKGROUNDS.find((b) => b.id === id)!,
      ),
    },
    ...BACKGROUND_GROUPS.map((group) => ({
      key: group,
      title: t(`groups.${group}`),
      items: BACKGROUNDS.filter(
        (b) => b.group === group && !RECOMMENDED_BACKGROUNDS.includes(b.id),
      ),
    })),
  ].filter((section) => section.items.length > 0);

  function themeCard(b: Background) {
    const open = isBackgroundOpen(b.id, points);
    const name = t(`names.${b.id}`);
    const checked = chosen === b.id;
    const status =
      b.unlock.kind === "free"
        ? t("free")
        : b.unlock.kind === "paid"
          ? t("paidOnly")
          : open
            ? t("open")
            : t("needs", { points: b.unlock.at - points });
    return (
      <li
        key={b.id}
        className="space-y-3 rounded-base border border-line surface-card p-3 has-[input:checked]:border-accent has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-focus"
      >
        <label className={`block space-y-3 ${open ? "cursor-pointer" : ""}`}>
          <ThemePreview id={b.id} accent={accent} className="h-28" />
          <span className="flex min-h-11 items-center gap-3">
            <input
              type="radio"
              name="background"
              value={b.id}
              checked={checked}
              disabled={!open}
              onChange={() => choose(b.id)}
              className="size-4 shrink-0 accent-(--ll-accent)"
            />
            <span className="min-w-0 flex-1">
              <span className="block">
                {name}
                {b.motion && (
                  <span className="ml-2 text-metadata text-ink-muted">
                    {t("animated")}
                  </span>
                )}
              </span>
              <span className="block text-metadata text-ink-muted">
                {t(`cards.${b.card}`)} · {status}
              </span>
            </span>
            {checked && (
              <span className="shrink-0 text-metadata text-accent-ink">
                {t("inUse")}
              </span>
            )}
          </span>
        </label>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            size="sm"
            aria-label={t("previewLabel", { name })}
            onClick={() => startPreview(b.id)}
          >
            {t("preview")}
          </Button>
          {b.unlock.kind === "paid" && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => openOffer(b.id)}
            >
              {t("unlockForever", { price })}
            </Button>
          )}
        </div>
      </li>
    );
  }

  return (
    <section
      aria-labelledby="backgrounds-title"
      className="mt-16 border-t border-line pt-8"
    >
      <h2 id="backgrounds-title" className="font-display text-h2">
        {t("title")}
      </h2>
      <p className="mt-4 max-w-reading text-ink-muted">{t("intro")}</p>
      <p className="mt-2 max-w-reading text-supporting text-ink-muted">
        {t("previewNote")}
      </p>
      <p className="mt-2 max-w-reading text-supporting text-ink-muted">
        {score === null
          ? t("loading")
          : next
            ? t("next", {
                score: points,
                needed: next.needed,
                name: t(`names.${next.id}`),
              })
            : t("allOpen", { score: points })}
      </p>

      {preview && (
        <div
          role="status"
          className="sticky top-2 z-10 mt-6 flex flex-wrap items-center gap-3 rounded-base border border-accent bg-surface p-3"
        >
          <span className="flex-1">
            {t("previewing", { name: t(`names.${preview}`) })}
          </span>
          {isBackgroundOpen(preview, points) && (
            <Button variant="primary" size="sm" onClick={() => choose(preview)}>
              {t("apply")}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={endPreview}>
            {t("endPreview")}
          </Button>
        </div>
      )}

      <fieldset className="mt-8 space-y-10">
        <legend className="sr-only">{t("title")}</legend>
        {sections.map((section) => (
          <div key={section.key} className="space-y-3">
            <h3 className="font-display text-h3">{section.title}</h3>
            <ul className="grid gap-4 split:grid-cols-2 wide:grid-cols-3">
              {section.items.map(themeCard)}
            </ul>
          </div>
        ))}
      </fieldset>
      <p className="mt-6 max-w-reading text-supporting text-ink-muted">
        {t("motionNote")}
      </p>

      {offer && (
        <Dialog
          title={t("offerTitle", { name: t(`names.${offer}`) })}
          onClose={() => setOffer(null)}
        >
          <p>{t("offerBody", { price })}</p>
          {joined && (
            <p role="status" className="text-success">
              <span aria-hidden="true">✓ </span>
              {t("offerJoined")}
            </p>
          )}
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
