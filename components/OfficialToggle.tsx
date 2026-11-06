"use client";

import { useTranslations } from "next-intl";
import { setOfficial as setOfficialAction } from "@/app/materials/organize-actions";
import { Button } from "./Button";
import { useOrganizeAction } from "./useOrganizeAction";

/**
 * Marks an admin's practice official (listed in the library for
 * everyone, always public) or not (D46).
 */
export function OfficialToggle({
  practice,
  setOfficial = setOfficialAction,
}: {
  practice: { id: string; title: string; official: boolean };
  /** Injected in tests; the Server Action otherwise. */
  setOfficial?: typeof setOfficialAction;
}) {
  const t = useTranslations("organize");
  const action = useOrganizeAction();
  return (
    <div className="space-y-1">
      <Button
        variant={practice.official ? "secondary" : "ghost"}
        size="sm"
        aria-pressed={practice.official}
        aria-label={t("officialLabel", { title: practice.title })}
        onClick={() =>
          action.run(() => setOfficial(practice.id, !practice.official))
        }
        disabled={action.pending}
      >
        {practice.official ? t("officialOn") : t("officialOff")}
      </Button>
      {action.error && (
        <p role="alert" className="text-supporting text-error">
          {t(`errors.${action.error}`)}
        </p>
      )}
    </div>
  );
}
