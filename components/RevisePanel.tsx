"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import {
  reviseDraft,
  type ReviseDraftResult,
  type TranslateResult,
} from "@/app/materials/actions";
import type { DraftSentence } from "@/lib/custom-practice/draft";
import { TRANSLATE_BATCH } from "@/lib/custom-practice/notes";
import {
  INSTRUCTION_MAX_CHARS,
  reuseTranslations,
} from "@/lib/custom-practice/revise";
import type { UsageBlock } from "@/lib/usage";
import { Button } from "./Button";
import { UsageLimitMessage } from "./UsageLimitMessage";

export type ReviseText = (input: {
  lines: string[];
  instruction: string;
  format: "dialogue" | "monologue";
}) => Promise<ReviseDraftResult>;

type Translate = (
  sentences: string[],
  language: "en",
) => Promise<TranslateResult>;

/**
 * "Revise with an instruction" (D96), on the review step: the learner
 * types what to change, the model rewrites the English, and only the
 * sentences that changed are translated again. Each revision can be
 * undone (the form keeps the steps); every call counts in the daily
 * allowance.
 */
export function RevisePanel({
  sentences,
  dialogue,
  disabled,
  canUndo,
  onRevised,
  onUndo,
  translate,
  revise = reviseDraft,
}: {
  sentences: readonly DraftSentence[];
  dialogue: boolean;
  disabled: boolean;
  canUndo: boolean;
  onRevised: (next: DraftSentence[]) => void;
  onUndo: () => void;
  translate: Translate;
  /** Injected in tests; the Server Action otherwise. */
  revise?: ReviseText;
}) {
  const t = useTranslations("revise");
  const id = useId();
  const [instruction, setInstruction] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<{
    reason: string;
    usage?: UsageBlock;
  } | null>(null);

  async function run() {
    setPending(true);
    setError(null);
    setStatus(t("working"));
    const result = await revise({
      lines: sentences.map((s) => s.en),
      instruction,
      format: dialogue ? "dialogue" : "monologue",
    }).catch((): ReviseDraftResult => ({ ok: false, reason: "failed" }));
    if (!result.ok) {
      setPending(false);
      setStatus(null);
      setError({ reason: result.reason, usage: result.limit });
      return;
    }
    const next = reuseTranslations(sentences, result.lines);
    const changed = next.filter((s) => s.zh === null);
    setStatus(t("translating", { count: changed.length }));
    const translations: string[] = [];
    for (let start = 0; start < changed.length; start += TRANSLATE_BATCH) {
      const batch = changed.slice(start, start + TRANSLATE_BATCH);
      const done = await translate(
        batch.map((s) => s.en),
        "en",
      ).catch((): TranslateResult => ({ ok: false, reason: "failed" }));
      if (!done.ok) {
        setPending(false);
        setStatus(null);
        setError({
          reason: done.reason === "limit" ? "limit" : "failed",
          usage: "limit" in done ? done.limit : undefined,
        });
        return;
      }
      translations.push(...done.translations);
    }
    let at = 0;
    onRevised(
      next.map((s) => ({
        en: s.en,
        zh: s.zh ?? translations[at++] ?? "",
        ...(s.speaker === undefined ? {} : { speaker: s.speaker }),
      })),
    );
    setPending(false);
    setInstruction("");
    setStatus(t("done", { changed: changed.length, total: next.length }));
  }

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="space-y-3 rounded-base border border-line bg-surface p-4"
    >
      <h3 id={`${id}-title`} className="font-display text-h3">
        {t("title")}
      </h3>
      <p id={`${id}-hint`} className="text-supporting text-ink-muted">
        {t("hint")}
      </p>
      <label className="block space-y-1">
        <span className="sr-only">{t("label")}</span>
        <input
          type="text"
          value={instruction}
          maxLength={INSTRUCTION_MAX_CHARS}
          placeholder={t("placeholder")}
          aria-describedby={`${id}-hint`}
          onChange={(event) => setInstruction(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.nativeEvent.isComposing &&
              instruction.trim() &&
              !pending
            ) {
              event.preventDefault();
              void run();
            }
          }}
          disabled={disabled || pending}
          className="block w-full rounded-base border border-line bg-ground px-4 py-3 focus-visible:border-accent"
        />
      </label>
      <div className="flex flex-wrap gap-3">
        <Button
          variant="secondary"
          onClick={run}
          disabled={disabled || pending || !instruction.trim()}
        >
          {pending ? t("revising") : t("revise")}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            onUndo();
            setStatus(t("undone"));
          }}
          disabled={disabled || pending || !canUndo}
        >
          {t("undo")}
        </Button>
      </div>
      <p role="status" className="text-supporting text-ink-muted">
        {status}
      </p>
      {error && (
        <p role="alert" className="text-supporting text-error">
          {error.reason === "limit" ? (
            <UsageLimitMessage
              block={error.usage}
              fallback={t("errors.limit")}
            />
          ) : (
            t(error.reason === "busy" ? "errors.busy" : "errors.failed")
          )}
        </p>
      )}
    </section>
  );
}
