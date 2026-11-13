"use client";

import { useLocale, useTranslations } from "next-intl";
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

type Preview = {
  /** The sentences as they'd be: translation kept, or null to translate. */
  next: { en: string; zh: string | null; speaker?: 0 | 1 }[];
  /** English of the sentences the revision drops. */
  removed: string[];
};

/**
 * "Revise with an instruction" (D96, D123), on the review step: the
 * learner types what to change, the model rewrites the English, and the
 * change is shown as a preview (before and after, changed sentences
 * marked). Only "apply" writes it, translating the changed sentences then;
 * each applied revision can be undone (the form keeps the steps). A
 * failure says why, never "0 sentences changed". Every model call counts
 * in the daily allowance.
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
  const uiLang = useLocale();
  const id = useId();
  const [instruction, setInstruction] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<{
    reason: string;
    detail?: string;
    usage?: UsageBlock;
    /** For "daily": the plan's revises a day (D161). */
    max?: number;
  } | null>(null);

  function fail(
    reason: string,
    extra?: { detail?: string; usage?: UsageBlock; max?: number },
  ) {
    setPending(false);
    setStatus(null);
    setError({ reason, ...extra });
  }

  async function run() {
    setPending(true);
    setError(null);
    setPreview(null);
    setStatus(t("working"));
    const result = await revise({
      lines: sentences.map((s) => s.en),
      instruction,
      format: dialogue ? "dialogue" : "monologue",
    }).catch((): ReviseDraftResult => ({ ok: false, reason: "failed" }));
    if (!result.ok) {
      if (result.reason === "daily") {
        fail("daily", { max: result.max });
        return;
      }
      fail(result.reason, { detail: result.detail, usage: result.limit });
      return;
    }
    setPending(false);
    if (result.status === "unchanged") {
      setStatus(
        result.reason
          ? t("unchanged", { reason: result.reason })
          : t("unchangedGeneric"),
      );
      return;
    }
    const next = reuseTranslations(sentences, result.lines);
    const kept = new Set(next.map((s) => s.en));
    setPreview({
      next,
      removed: sentences.map((s) => s.en).filter((en) => !kept.has(en)),
    });
    setStatus(
      t("previewReady", {
        changed: next.filter((s) => s.zh === null).length,
        total: next.length,
      }),
    );
  }

  async function apply() {
    if (!preview) return;
    setPending(true);
    setError(null);
    const changed = preview.next.filter((s) => s.zh === null);
    setStatus(t("translating", { count: changed.length }));
    const translations: string[] = [];
    for (let start = 0; start < changed.length; start += TRANSLATE_BATCH) {
      const batch = changed.slice(start, start + TRANSLATE_BATCH);
      const done = await translate(
        batch.map((s) => s.en),
        "en",
      ).catch((): TranslateResult => ({ ok: false, reason: "failed" }));
      if (!done.ok) {
        // The preview stays, so "apply" can be tried again.
        fail(done.reason === "limit" ? "limit" : "failed", {
          usage: "limit" in done ? done.limit : undefined,
        });
        return;
      }
      translations.push(...done.translations);
    }
    let at = 0;
    onRevised(
      preview.next.map((s) => ({
        en: s.en,
        zh: s.zh ?? translations[at++] ?? "",
        ...(s.speaker === undefined ? {} : { speaker: s.speaker }),
      })),
    );
    setPending(false);
    setPreview(null);
    setInstruction("");
    setStatus(
      t("done", { changed: changed.length, total: preview.next.length }),
    );
  }

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="space-y-3 rounded-base border border-line surface-card p-4"
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
              !pending &&
              !preview
            ) {
              event.preventDefault();
              void run();
            }
          }}
          disabled={disabled || pending || preview !== null}
          className="block w-full rounded-base border border-line bg-ground px-4 py-3 focus-visible:border-accent"
        />
      </label>
      {!preview && (
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
              setError(null);
              setStatus(t("undone"));
            }}
            disabled={disabled || pending || !canUndo}
          >
            {t("undo")}
          </Button>
        </div>
      )}
      {preview && (
        <div
          aria-labelledby={`${id}-preview`}
          role="group"
          className="space-y-3 border-t border-line pt-3"
        >
          <h4 id={`${id}-preview`} className="font-medium">
            {t("previewTitle")}
          </h4>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-metadata text-ink-muted">{t("before")}</p>
              <ol className="space-y-2" lang="en">
                {sentences.map((s, index) => {
                  const gone = preview.removed.includes(s.en);
                  return (
                    <li
                      key={index}
                      className={
                        gone
                          ? "border-l-2 border-line pl-3 text-ink-muted line-through"
                          : "border-l-2 border-transparent pl-3 text-ink-muted"
                      }
                    >
                      {gone && <span className="sr-only">{t("removed")}</span>}
                      {s.en}
                    </li>
                  );
                })}
              </ol>
            </div>
            <div className="space-y-2">
              <p className="text-metadata text-ink-muted">{t("after")}</p>
              <ol className="space-y-2" lang="en">
                {preview.next.map((s, index) => (
                  <li
                    key={index}
                    className={
                      s.zh === null
                        ? "border-l-2 border-accent pl-3"
                        : "border-l-2 border-transparent pl-3 text-ink-muted"
                    }
                  >
                    {s.zh === null && (
                      <span
                        lang={uiLang}
                        className="mr-2 text-metadata font-medium text-accent-ink"
                      >
                        {t("changedMark")}
                      </span>
                    )}
                    {s.en}
                  </li>
                ))}
              </ol>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={apply} disabled={disabled || pending}>
              {pending ? t("applying") : t("apply")}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setPreview(null);
                setError(null);
                setStatus(t("discarded"));
              }}
              disabled={pending}
            >
              {t("discard")}
            </Button>
          </div>
        </div>
      )}
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
          ) : error.reason === "daily" ? (
            t("errors.daily", { max: error.max ?? 0 })
          ) : error.reason === "filtered" ? (
            <>
              {t("errors.filtered")}
              {error.detail && ` ${error.detail}`}
            </>
          ) : (
            t(error.reason === "busy" ? "errors.busy" : "errors.failed")
          )}
        </p>
      )}
    </section>
  );
}
