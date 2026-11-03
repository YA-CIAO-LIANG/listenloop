"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { setVisibility as setVisibilityAction } from "@/app/create/organize-actions";
import type { Visibility } from "@/lib/custom-practice/organize";
import { SegmentedControl } from "./SegmentedControl";
import { useOrganizeAction } from "./useOrganizeAction";

type VisibilityToggleProps = {
  kind: "practice" | "collection";
  id: string;
  /** What it's for, read by screen readers, e.g. the practice's title. */
  name: string;
  visibility: Visibility;
  /** Injected in tests; the Server Action otherwise. */
  setVisibility?: typeof setVisibilityAction;
};

/** "Private / Public" for a practice or collection, saved on change. */
export function VisibilityToggle({
  kind,
  id,
  name,
  visibility: saved,
  setVisibility = setVisibilityAction,
}: VisibilityToggleProps) {
  const t = useTranslations("organize");
  // Shown at once; put back if saving fails.
  const [visibility, setShown] = useState(saved);
  const { pending, error, run } = useOrganizeAction();

  async function change(next: Visibility) {
    setShown(next);
    if (!(await run(() => setVisibility(kind, id, next)))) setShown(saved);
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
        onChange={change}
        busy={pending}
        optionWidthClassName="min-w-14"
      />
      {error && (
        <p role="alert" className="text-supporting text-error">
          {t(`errors.${error}`)}
        </p>
      )}
    </div>
  );
}
