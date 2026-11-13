"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import {
  resolveAbuseFlag as resolveAction,
  type AbuseResult,
} from "@/app/admin/abuse/actions";
import { Button } from "./Button";

/** Confirm or dismiss one abuse flag (D162), with an optional note. */
export function AbuseControls({
  id,
  resolve = resolveAction,
}: {
  id: string;
  resolve?: typeof resolveAction;
}) {
  const t = useTranslations("admin.abuse");
  const router = useRouter();
  const noteId = useId();
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<AbuseResult | null>(null);

  async function decide(decision: "confirmed" | "dismissed") {
    setPending(true);
    const answer = await resolve({ id, decision, note }).catch(
      (): AbuseResult => ({ ok: false, reason: "failed" }),
    );
    setResult(answer);
    setPending(false);
    if (answer.ok) router.refresh();
  }

  return (
    <div className="space-y-2">
      <label htmlFor={noteId} className="sr-only">
        {t("note")}
      </label>
      <input
        id={noteId}
        value={note}
        maxLength={500}
        placeholder={t("note")}
        onChange={(e) => setNote(e.target.value)}
        className="h-10 w-full rounded-base border border-line bg-surface px-3 focus-visible:border-accent pointer-coarse:min-h-11"
      />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="primary"
          disabled={pending}
          onClick={() => decide("confirmed")}
        >
          {t("confirm")}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => decide("dismissed")}
        >
          {t("dismiss")}
        </Button>
      </div>
      {result && !result.ok && (
        <p role="alert" className="text-supporting text-error">
          {t(`errors.${result.reason}`)}
        </p>
      )}
    </div>
  );
}
