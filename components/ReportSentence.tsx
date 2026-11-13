"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import {
  reportSentence as reportSentenceAction,
  type SentenceReportResult,
} from "@/app/reports/sentence-actions";
import {
  SENTENCE_REPORT_KINDS,
  SENTENCE_REPORT_NOTE_MAX,
  type SentenceReportKind,
} from "@/lib/sentence-reports";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { FlagIcon } from "./icons";
import { useProgressVisible } from "./StoresProvider";
import { Turnstile } from "./Turnstile";

type Problem = Exclude<SentenceReportResult, { ok: true }>["reason"];

/**
 * "Report a problem" under a sentence's notes (D113): wrong translation,
 * wrong notes, or bad audio, with an optional note. Signed in only, so the
 * learner can be told when it's fixed.
 */
export function ReportSentence({
  videoId,
  version,
  index,
  report = reportSentenceAction,
}: {
  videoId: string;
  version?: number;
  index: number;
  report?: typeof reportSentenceAction;
}) {
  const t = useTranslations("sentenceReport");
  const signedIn = useProgressVisible();
  const ids = useId();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<SentenceReportKind | null>(null);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [sent, setSent] = useState<number | null>(null);
  const [turnstile, setTurnstile] = useState("");
  const tooLong = [...note].length > SENTENCE_REPORT_NOTE_MAX;

  async function submit() {
    if (!kind || tooLong) return;
    setPending(true);
    setProblem(null);
    const result = await report({
      videoId,
      version: version ?? null,
      index,
      kind,
      note,
      turnstile,
    }).catch((): SentenceReportResult => ({ ok: false, reason: "failed" }));
    setPending(false);
    if (result.ok) {
      setSent(index);
      setOpen(false);
      setKind(null);
      setNote("");
    } else {
      setProblem(result.reason);
    }
  }

  if (sent === index) {
    return (
      <p role="status" className="text-supporting text-success">
        {t("sent")}
      </p>
    );
  }

  return (
    <>
      {/* A visible secondary button with a flag (D124), not a quiet link. */}
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <FlagIcon className="size-4 shrink-0" />
        {t("open")}
      </Button>
      {open && (
        <Dialog
          title={t("title", { n: index + 1 })}
          onClose={() => setOpen(false)}
        >
          {signedIn ? (
            <div className="space-y-4">
              <fieldset className="space-y-2">
                <legend className="font-medium">{t("kindLabel")}</legend>
                {SENTENCE_REPORT_KINDS.map((value) => (
                  <label key={value} className="tap flex items-center gap-2">
                    <input
                      type="radio"
                      name={`${ids}-kind`}
                      value={value}
                      checked={kind === value}
                      onChange={() => setKind(value)}
                    />
                    {t(`kinds.${value}`)}
                  </label>
                ))}
              </fieldset>
              <div className="space-y-2">
                <label htmlFor={`${ids}-note`} className="block font-medium">
                  {t("noteLabel")}
                </label>
                <textarea
                  id={`${ids}-note`}
                  value={note}
                  rows={3}
                  onChange={(event) => setNote(event.target.value)}
                  aria-invalid={tooLong}
                  className="block w-full rounded-base border border-line bg-surface px-4 py-3 focus-visible:border-accent"
                />
                <p
                  className={`text-supporting ${tooLong ? "text-error" : "text-ink-muted"}`}
                >
                  {t("noteHint", { max: SENTENCE_REPORT_NOTE_MAX })}
                </p>
              </div>
              <Turnstile action="sentence-report" onToken={setTurnstile} />
              {problem && (
                <p role="alert" className="text-supporting text-error">
                  {t(`problems.${problem}`)}
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="primary"
                  disabled={!kind || tooLong || pending}
                  onClick={submit}
                >
                  {pending ? t("sending") : t("send")}
                </Button>
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  {t("cancel")}
                </Button>
              </div>
            </div>
          ) : (
            <p>{t("signIn")}</p>
          )}
        </Dialog>
      )}
    </>
  );
}
