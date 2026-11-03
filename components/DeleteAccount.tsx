"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { deleteAccount, type DeleteAccountResult } from "@/auth/actions";
import { clearPracticeData } from "@/lib/storage/clear-local";
import { Button } from "./Button";

type DeleteAccountProps = {
  /** Injected in tests; the Server Action otherwise. */
  onDelete?: () => Promise<DeleteAccountResult>;
};

/**
 * "Delete account": first reveals what will be lost and a checkbox to
 * confirm, then deletes the account on the server, clears this browser's
 * practice data, and reloads the account page, which confirms it.
 */
export function DeleteAccount({
  onDelete = deleteAccount,
}: DeleteAccountProps) {
  const t = useTranslations("accountPage.delete");
  const router = useRouter();
  const confirmId = useId();
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<"failed" | "signed-out" | null>(null);

  async function remove() {
    setPending(true);
    setError(null);
    const result = await onDelete().catch((): DeleteAccountResult => ({
      ok: false,
      reason: "failed",
    }));
    if (!result.ok) {
      setPending(false);
      setError(result.reason);
      return;
    }
    clearPracticeData(window.localStorage);
    // The account page, now signed out, confirms the deletion.
    router.replace("/account?deleted=1");
    router.refresh();
  }

  if (!open) {
    return (
      <Button variant="danger" onClick={() => setOpen(true)}>
        {t("start")}
      </Button>
    );
  }

  return (
    <div className="space-y-4 rounded-base border border-error p-6">
      <p className="font-medium">{t("warningTitle")}</p>
      <ul className="list-disc space-y-1 pl-5 text-supporting text-ink-muted">
        <li>{t("lossAccount")}</li>
        <li>{t("lossProgress")}</li>
        <li>{t("lossDevice")}</li>
      </ul>
      <label htmlFor={confirmId} className="flex items-start gap-3">
        <input
          id={confirmId}
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="mt-1 size-4 accent-error"
        />
        <span>{t("confirm")}</span>
      </label>
      <div className="flex flex-wrap gap-3">
        <Button
          variant="danger"
          onClick={remove}
          disabled={!confirmed || pending}
        >
          {pending ? t("deleting") : t("submit")}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setConfirmed(false);
            setError(null);
          }}
          disabled={pending}
        >
          {t("cancel")}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-supporting text-error">
          {t(error === "signed-out" ? "signedOut" : "failed")}
        </p>
      )}
    </div>
  );
}
