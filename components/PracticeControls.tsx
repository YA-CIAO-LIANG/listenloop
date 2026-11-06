"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import {
  deletePractice as deletePracticeAction,
  movePractice as movePracticeAction,
} from "@/app/materials/organize-actions";
import type { Visibility } from "@/lib/custom-practice/organize";
import { Button } from "./Button";
import { useOrganizeAction } from "./useOrganizeAction";
import { VisibilityToggle } from "./VisibilityToggle";

type PracticeControlsProps = {
  practice: {
    id: string;
    title: string;
    /** Taken down by an admin (D31): it can't be made public again. */
    removed?: boolean;
    /** Official (D46): always public, so there's no private switch. */
    official?: boolean;
    collectionId: string | null;
    visibility: Visibility;
  };
  collections: { id: string; title: string }[];
  /** Injected in tests; the Server Actions otherwise. */
  movePractice?: typeof movePracticeAction;
  deletePractice?: typeof deletePracticeAction;
};

/** A created practice's collection, public or private, and deleting it. */
export function PracticeControls({
  practice,
  collections,
  movePractice = movePracticeAction,
  deletePractice = deletePracticeAction,
}: PracticeControlsProps) {
  const t = useTranslations("organize");
  const selectId = useId();
  const [confirming, setConfirming] = useState(false);
  const move = useOrganizeAction();
  const remove = useOrganizeAction();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-2">
          <label htmlFor={selectId} className="text-supporting text-ink-muted">
            {t("collectionLabel")}
          </label>
          <select
            id={selectId}
            value={practice.collectionId ?? ""}
            disabled={move.pending}
            onChange={(event) =>
              move.run(() =>
                movePractice(practice.id, event.target.value || null),
              )
            }
            className="h-8 rounded-base border border-line bg-surface px-2 text-supporting focus-visible:border-accent pointer-coarse:min-h-11"
          >
            <option value="">{t("ungrouped")}</option>
            {collections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.title}
              </option>
            ))}
          </select>
        </div>
        {practice.official ? (
          <p className="text-supporting text-ink-muted">
            {t("officialPublic")}
          </p>
        ) : (
          !practice.removed && (
            <VisibilityToggle
              kind="practice"
              id={practice.id}
              name={practice.title}
              visibility={practice.visibility}
            />
          )
        )}
        {!confirming && (
          <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
            {t("deletePractice")}
          </Button>
        )}
      </div>
      {move.error && (
        <p role="alert" className="text-supporting text-error">
          {t(`errors.${move.error}`)}
        </p>
      )}
      {confirming && (
        <div className="space-y-3 rounded-base border border-error p-4">
          <p className="text-supporting">
            {t("deletePracticeConfirm", { title: practice.title })}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="danger"
              size="sm"
              disabled={remove.pending}
              onClick={() => remove.run(() => deletePractice(practice.id))}
            >
              {remove.pending ? t("deleting") : t("deletePracticeButton")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={remove.pending}
              onClick={() => {
                setConfirming(false);
                remove.clearError();
              }}
            >
              {t("cancel")}
            </Button>
          </div>
          {remove.error && (
            <p role="alert" className="text-supporting text-error">
              {t(`errors.${remove.error}`)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
