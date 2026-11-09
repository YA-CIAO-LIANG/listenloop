"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";
import { recordIntent } from "@/app/intent-actions";
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
  type BackgroundId,
} from "@/lib/backgrounds";
import { formatPrice } from "@/lib/payments/pricing";
import { scoreEntries, totalScore } from "@/lib/score-points";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { useStores } from "./StoresProvider";

// The chosen background, remembered in this browser (D121); the server
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
/** Shows `id` on the whole page (without saving it). */
function show(id: BackgroundId) {
  const attribute = backgroundAttribute(id);
  if (attribute) document.documentElement.setAttribute("data-bg", attribute);
  else document.documentElement.removeAttribute("data-bg");
}
function save(id: BackgroundId) {
  try {
    localStorage.setItem(BACKGROUND_STORAGE_KEY, id);
  } catch {
    // Not remembered; it still changes on this page.
  }
  show(id);
  listeners.forEach((listener) => listener());
}

/**
 * Background themes (D121) in the account settings: each one's light and
 * dark look, grouped by style. Open ones (free, or reached by practice
 * score) can be chosen; any one can be previewed on the whole page; the
 * animated ones have an "unlock forever" fake door that records interest.
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

  // Leaving the page ends a preview: back to the saved background.
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
        {BACKGROUND_GROUPS.map((group) => (
          <div key={group} className="space-y-3">
            <h3 className="font-display text-h3">{t(`groups.${group}`)}</h3>
            <ul className="grid gap-4 split:grid-cols-2 wide:grid-cols-3">
              {BACKGROUNDS.filter((b) => b.group === group).map((b) => {
                const open = isBackgroundOpen(b.id, points);
                const name = t(`names.${b.id}`);
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
                    className="space-y-3 rounded-base border border-line bg-surface p-3"
                  >
                    {/* Light and dark side by side, each its own theme. */}
                    <div
                      aria-hidden="true"
                      className="grid h-20 grid-cols-2 overflow-hidden rounded-base border border-line"
                    >
                      {(["light", "dark"] as const).map((mode) => (
                        <div key={mode} data-theme={mode}>
                          <div
                            data-bg={b.id}
                            className="bg-swatch flex h-full items-end p-2 text-metadata text-ink-muted"
                          >
                            {t(mode)}
                          </div>
                        </div>
                      ))}
                    </div>
                    <label
                      className={`flex min-h-11 items-center gap-3 ${open ? "cursor-pointer" : ""}`}
                    >
                      <input
                        type="radio"
                        name="background"
                        value={b.id}
                        checked={chosen === b.id}
                        disabled={!open}
                        onChange={() => choose(b.id)}
                        className="size-4 accent-(--ll-accent)"
                      />
                      <span>
                        <span className="block">
                          {name}
                          {b.motion && (
                            <span className="ml-2 text-metadata text-ink-muted">
                              {t("animated")}
                            </span>
                          )}
                        </span>
                        <span className="block text-metadata text-ink-muted">
                          {status}
                        </span>
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
              })}
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
