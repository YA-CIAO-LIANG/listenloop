"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { resolveSentenceReports } from "@/app/reports/sentence-actions";
import type { SentenceReportResolution } from "@/lib/sentence-reports";
import { Button } from "./Button";

/**
 * An admin closes one sentence's open reports (D113): fixed (the
 * reporters are told on their next visit) or not acted on, with an
 * optional note.
 */
export function SentenceReportActions({
  ids,
  resolve = resolveSentenceReports,
}: {
  ids: string[];
  resolve?: typeof resolveSentenceReports;
}) {
  const t = useTranslations("admin.sentenceReports");
  const noteId = useId();
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "pending" | "failed">("idle");

  async function close(resolution: SentenceReportResolution) {
    setState("pending");
    const result = await resolve(ids, resolution, note).catch(() => ({
      ok: false,
    }));
    setState(result.ok ? "idle" : "failed");
  }

  return (
    <div className="space-y-2">
      <label htmlFor={noteId} className="block text-supporting">
        {t("noteLabel")}
      </label>
      <input
        id={noteId}
        value={note}
        maxLength={500}
        onChange={(event) => setNote(event.target.value)}
        className="block w-full max-w-reading rounded-base border border-line bg-surface px-3 py-2 text-supporting focus-visible:border-accent"
      />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          size="sm"
          disabled={state === "pending"}
          onClick={() => close("fixed")}
        >
          {t("fixed")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={state === "pending"}
          onClick={() => close("dismissed")}
        >
          {t("dismissed")}
        </Button>
      </div>
      {state === "failed" && (
        <p role="alert" className="text-supporting text-error">
          {t("failed")}
        </p>
      )}
    </div>
  );
}
