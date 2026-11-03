"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import {
  createCollection as createCollectionAction,
  deleteCollection as deleteCollectionAction,
  renameCollection as renameCollectionAction,
} from "@/app/create/organize-actions";
import {
  COLLECTION_TITLE_MAX,
  type Visibility,
} from "@/lib/custom-practice/organize";
import { Button } from "./Button";
import { fieldClassName } from "./CreatePracticeForm";
import { useOrganizeAction } from "./useOrganizeAction";
import { VisibilityToggle } from "./VisibilityToggle";

export type CollectionSummary = {
  id: string;
  title: string;
  visibility: Visibility;
  practiceCount: number;
};

type CollectionManagerProps = {
  collections: CollectionSummary[];
  /** Injected in tests; the Server Actions otherwise. */
  createCollection?: typeof createCollectionAction;
  renameCollection?: typeof renameCollectionAction;
  deleteCollection?: typeof deleteCollectionAction;
};

/** Making, renaming, sharing, and deleting the user's collections. */
export function CollectionManager({
  collections,
  createCollection = createCollectionAction,
  renameCollection = renameCollectionAction,
  deleteCollection = deleteCollectionAction,
}: CollectionManagerProps) {
  const t = useTranslations("organize");
  const newId = useId();
  const [title, setTitle] = useState("");
  const create = useOrganizeAction();

  async function add() {
    if (await create.run(() => createCollection(title))) setTitle("");
  }

  return (
    <div className="space-y-6">
      <p className="text-ink-muted">{t("collectionsIntro")}</p>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void add();
        }}
      >
        <div className="min-w-0 flex-1 space-y-2">
          <label htmlFor={newId} className="block font-medium">
            {t("newCollection")}
          </label>
          <input
            id={newId}
            type="text"
            value={title}
            maxLength={COLLECTION_TITLE_MAX}
            onChange={(event) => setTitle(event.target.value)}
            disabled={create.pending}
            className={fieldClassName}
          />
        </div>
        <Button
          type="submit"
          disabled={create.pending || !title.trim()}
          className="mb-1"
        >
          {t("addCollection")}
        </Button>
      </form>
      {create.error && (
        <p role="alert" className="text-supporting text-error">
          {t(`errors.${create.error}`)}
        </p>
      )}
      {collections.length > 0 && (
        <ul className="divide-y divide-line border-y border-line">
          {collections.map((collection) => (
            <CollectionRow
              key={collection.id}
              collection={collection}
              renameCollection={renameCollection}
              deleteCollection={deleteCollection}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function CollectionRow({
  collection,
  renameCollection,
  deleteCollection,
}: {
  collection: CollectionSummary;
  renameCollection: typeof renameCollectionAction;
  deleteCollection: typeof deleteCollectionAction;
}) {
  const t = useTranslations("organize");
  const inputId = useId();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(collection.title);
  const [confirming, setConfirming] = useState(false);
  const action = useOrganizeAction();

  async function rename() {
    if (await action.run(() => renameCollection(collection.id, title))) {
      setEditing(false);
    }
  }

  return (
    <li className="space-y-3 py-4">
      {editing ? (
        <form
          className="flex flex-wrap items-center gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void rename();
          }}
        >
          <label htmlFor={inputId} className="sr-only">
            {t("renameLabel", { title: collection.title })}
          </label>
          <input
            id={inputId}
            type="text"
            value={title}
            maxLength={COLLECTION_TITLE_MAX}
            onChange={(event) => setTitle(event.target.value)}
            disabled={action.pending}
            className={`${fieldClassName} min-w-0 flex-1`}
          />
          <Button
            type="submit"
            size="sm"
            variant="primary"
            disabled={action.pending || !title.trim()}
          >
            {t("save")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={action.pending}
            onClick={() => {
              setEditing(false);
              setTitle(collection.title);
              action.clearError();
            }}
          >
            {t("cancel")}
          </Button>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <p>
            <span className="font-medium">{collection.title}</span>
            <span className="ml-3 text-supporting text-ink-muted">
              {t("practiceCount", { count: collection.practiceCount })}
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <VisibilityToggle
              kind="collection"
              id={collection.id}
              name={collection.title}
              visibility={collection.visibility}
            />
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              {t("rename")}
            </Button>
            {!confirming && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirming(true)}
              >
                {t("deleteCollection")}
              </Button>
            )}
          </div>
        </div>
      )}
      {confirming && (
        <div className="space-y-3 rounded-base border border-error p-4">
          <p className="text-supporting">
            {t("deleteCollectionConfirm", { title: collection.title })}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="danger"
              size="sm"
              disabled={action.pending}
              onClick={() => action.run(() => deleteCollection(collection.id))}
            >
              {action.pending ? t("deleting") : t("deleteCollectionButton")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={action.pending}
              onClick={() => {
                setConfirming(false);
                action.clearError();
              }}
            >
              {t("cancel")}
            </Button>
          </div>
        </div>
      )}
      {action.error && (
        <p role="alert" className="text-supporting text-error">
          {t(`errors.${action.error}`)}
        </p>
      )}
    </li>
  );
}
