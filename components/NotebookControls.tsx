"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import {
  addEntry as addEntryAction,
  createNotebook as createNotebookAction,
  deleteEntry as deleteEntryAction,
  deleteNotebook as deleteNotebookAction,
  renameNotebook as renameNotebookAction,
} from "@/app/notebooks/actions";
import { NOTEBOOK_LIMITS } from "@/lib/custom-practice/organize";
import { Button } from "./Button";
import { fieldClassName } from "./CreatePracticeForm";
import { useOrganizeAction, type OrganizeError } from "./useOrganizeAction";

function ErrorLine({ error }: { error: OrganizeError | null }) {
  const t = useTranslations("notebooks");
  if (!error) return null;
  return (
    <p role="alert" className="text-supporting text-error">
      {t(`errors.${error}`)}
    </p>
  );
}

/** "New notebook": a name and Add. */
export function NewNotebookForm({
  createNotebook = createNotebookAction,
}: {
  createNotebook?: typeof createNotebookAction;
}) {
  const t = useTranslations("notebooks");
  const id = useId();
  const [title, setTitle] = useState("");
  const action = useOrganizeAction();

  return (
    <div className="space-y-3">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          if (await action.run(() => createNotebook(title))) setTitle("");
        }}
      >
        <div className="min-w-0 flex-1 space-y-2">
          <label htmlFor={id} className="block font-medium">
            {t("newNotebook")}
          </label>
          <input
            id={id}
            type="text"
            value={title}
            maxLength={NOTEBOOK_LIMITS.title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={action.pending}
            className={fieldClassName}
          />
        </div>
        <Button
          type="submit"
          disabled={action.pending || !title.trim()}
          className="mb-1"
        >
          {t("add")}
        </Button>
      </form>
      <ErrorLine error={action.error} />
    </div>
  );
}

/** Renaming and deleting a notebook, on its own page. */
export function NotebookSettings({
  notebook,
  renameNotebook = renameNotebookAction,
  deleteNotebook = deleteNotebookAction,
}: {
  notebook: { id: string; title: string };
  renameNotebook?: typeof renameNotebookAction;
  deleteNotebook?: typeof deleteNotebookAction;
}) {
  const t = useTranslations("notebooks");
  const router = useRouter();
  const inputId = useId();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [title, setTitle] = useState(notebook.title);
  const action = useOrganizeAction();

  if (editing) {
    return (
      <div className="space-y-3">
        <form
          className="flex flex-wrap items-center gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            if (await action.run(() => renameNotebook(notebook.id, title))) {
              setEditing(false);
            }
          }}
        >
          <label htmlFor={inputId} className="sr-only">
            {t("renameLabel", { title: notebook.title })}
          </label>
          <input
            id={inputId}
            type="text"
            value={title}
            maxLength={NOTEBOOK_LIMITS.title}
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
              setTitle(notebook.title);
              action.clearError();
            }}
          >
            {t("cancel")}
          </Button>
        </form>
        <ErrorLine error={action.error} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          {t("rename")}
        </Button>
        {!confirming && (
          <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
            {t("deleteNotebook")}
          </Button>
        )}
      </div>
      {confirming && (
        <div className="space-y-3 rounded-base border border-error p-4">
          <p className="text-supporting">
            {t("deleteNotebookConfirm", { title: notebook.title })}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="danger"
              size="sm"
              disabled={action.pending}
              onClick={async () => {
                if (await action.run(() => deleteNotebook(notebook.id))) {
                  router.push("/notebooks");
                }
              }}
            >
              {action.pending ? t("deleting") : t("deleteNotebookButton")}
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
      <ErrorLine error={action.error} />
    </div>
  );
}

/** Adding a word or sentence, with an optional note. */
export function AddEntryForm({
  notebookId,
  addEntry = addEntryAction,
}: {
  notebookId: string;
  addEntry?: typeof addEntryAction;
}) {
  const t = useTranslations("notebooks");
  const ids = { text: useId(), note: useId() };
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const action = useOrganizeAction();

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (await action.run(() => addEntry(notebookId, text, note))) {
          setText("");
          setNote("");
        }
      }}
    >
      <div className="space-y-2">
        <label htmlFor={ids.text} className="block font-medium">
          {t("entryText")}
        </label>
        <input
          id={ids.text}
          type="text"
          lang="en"
          value={text}
          maxLength={NOTEBOOK_LIMITS.text}
          onChange={(event) => setText(event.target.value)}
          disabled={action.pending}
          className={`${fieldClassName} text-sentence`}
        />
      </div>
      <div className="space-y-2">
        <label htmlFor={ids.note} className="block font-medium">
          {t("entryNote")}
        </label>
        <textarea
          id={ids.note}
          rows={2}
          value={note}
          maxLength={NOTEBOOK_LIMITS.note}
          onChange={(event) => setNote(event.target.value)}
          disabled={action.pending}
          className={`${fieldClassName} resize-y`}
        />
      </div>
      <Button
        type="submit"
        variant="primary"
        disabled={action.pending || !text.trim()}
      >
        {action.pending ? t("saving") : t("addEntry")}
      </Button>
      <ErrorLine error={action.error} />
    </form>
  );
}

/** Deletes one entry right away: it's small and easy to add back. */
export function DeleteEntryButton({
  entry,
  deleteEntry = deleteEntryAction,
}: {
  entry: { id: string; text: string };
  deleteEntry?: typeof deleteEntryAction;
}) {
  const t = useTranslations("notebooks");
  const action = useOrganizeAction();
  return (
    <div className="space-y-1 text-right">
      <Button
        size="sm"
        variant="ghost"
        aria-label={t("deleteEntryLabel", { text: entry.text })}
        disabled={action.pending}
        onClick={() => action.run(() => deleteEntry(entry.id))}
      >
        {t("deleteEntry")}
      </Button>
      <ErrorLine error={action.error} />
    </div>
  );
}
