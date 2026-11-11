"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { setVisibility as setVisibilityAction } from "@/app/materials/organize-actions";
import type { Visibility } from "@/lib/custom-practice/organize";
import { Button } from "./Button";
import { SegmentedControl } from "./SegmentedControl";
import { useOrganizeAction } from "./useOrganizeAction";

type VisibilityToggleProps = {
  kind: "practice" | "collection";
  id: string;
  /** What it's for, read by screen readers, e.g. the practice's title. */
  name: string;
  visibility: Visibility;
  /**
   * A practice from the author's own recording (D130): before it goes
   * public, they confirm they own it or may share it.
   */
  needsRights?: boolean;
  /** Injected in tests; the Server Action otherwise. */
  setVisibility?: typeof setVisibilityAction;
};

/** "Private / Public" for a practice or collection, saved on change. */
export function VisibilityToggle({
  kind,
  id,
  name,
  visibility: saved,
  needsRights = false,
  setVisibility = setVisibilityAction,
}: VisibilityToggleProps) {
  const t = useTranslations("organize");
  // Shown at once; put back if saving fails.
  const [visibility, setShown] = useState(saved);
  const { pending, error, run } = useOrganizeAction();
  const [asking, setAsking] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const checkboxId = useId();

  async function change(next: Visibility, rights = false) {
    setShown(next);
    const ok = await run(() =>
      rights
        ? setVisibility(kind, id, next, true)
        : setVisibility(kind, id, next),
    );
    if (!ok) setShown(saved);
  }

  function choose(next: Visibility) {
    if (next === "public" && needsRights && visibility !== "public") {
      setAsking(true);
      return;
    }
    setAsking(false);
    void change(next);
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <SegmentedControl
        legend={t("visibilityLegend", { name })}
        value={visibility}
        options={[
          { value: "private", label: t("visibility.private") },
          { value: "public", label: t("visibility.public") },
        ]}
        onChange={choose}
        busy={pending}
        optionWidthClassName="min-w-14"
      />
      {asking && (
        <div className="basis-full space-y-3 rounded-base border border-line p-4">
          <div className="flex items-start gap-2">
            <input
              id={checkboxId}
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="mt-1 size-4 accent-accent pointer-coarse:size-5"
            />
            <label htmlFor={checkboxId} className="text-supporting">
              {t("rights.confirm")}
            </label>
          </div>
          <p className="text-supporting text-ink-muted">{t("rights.hint")}</p>
          <div className="flex flex-wrap gap-3">
            <Button
              size="sm"
              disabled={!confirmed || pending}
              onClick={() => {
                setAsking(false);
                void change("public", true);
              }}
            >
              {t("rights.makePublic")}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAsking(false)}>
              {t("rights.cancel")}
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-supporting text-error">
          {t(`errors.${error}`)}
        </p>
      )}
    </div>
  );
}
