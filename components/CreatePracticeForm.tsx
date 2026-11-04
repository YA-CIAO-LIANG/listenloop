"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useRef, useState, type ChangeEvent } from "react";
import {
  createPractice,
  generatePracticeAudio,
  generatePracticeNotes,
  prepareSentences,
  type CreatePracticeResult,
  type PrepareResult,
} from "@/app/materials/actions";
import {
  DEFAULT_VOICE,
  PRACTICE_LIMITS,
  titleFromFileName,
  type DraftSentence,
} from "@/lib/custom-practice/draft";
import {
  detectTextLanguage,
  type TextSourceLanguage,
} from "@/lib/custom-practice/split";
import { countChars } from "@/lib/usage";
import {
  prepareForPractice,
  type GenerateAudio,
  type GenerateNotes,
  type GenerationStage,
} from "./practice-generation";
import { Button, buttonClassName } from "./Button";
import { SegmentedControl } from "./SegmentedControl";
import { VoicePicker, voiceSampleUrl } from "./VoicePicker";

type CreatePracticeFormProps = {
  /** Injected in tests; the Server Actions otherwise. */
  prepare?: (
    text: string,
    language: TextSourceLanguage,
  ) => Promise<PrepareResult>;
  create?: (draft: {
    title: string;
    sourceLanguage: TextSourceLanguage;
    voice: string;
    sentences: DraftSentence[];
  }) => Promise<CreatePracticeResult>;
  generate?: GenerateAudio;
  generateNotes?: GenerateNotes;
};

type FormError =
  | { key: Exclude<PrepareResult, { ok: true }>["reason"] }
  | { key: "file-too-large" | "file-type" | "file-encoding" | "file-read" }
  | {
      key: Extract<CreatePracticeResult, { reason: "invalid" }>["problem"];
      sentence?: number;
    }
  | { key: "unavailable" | "failed" };

/** Rows get stable keys so deleting one doesn't move another's text. */
type Row = DraftSentence & { key: number };

export const fieldClassName =
  "block w-full rounded-base border border-line bg-surface px-4 py-3 focus-visible:border-accent";

/**
 * Two steps: write (title, text pasted or loaded from a .txt file, its
 * language), then review the split and translated sentences, edit them,
 * and create the practice.
 */
export function CreatePracticeForm({
  prepare = prepareSentences,
  create = createPractice,
  generate = generatePracticeAudio,
  generateNotes = generatePracticeNotes,
}: CreatePracticeFormProps) {
  const t = useTranslations("create");
  const router = useRouter();
  const ids = { title: useId(), text: useId(), hint: useId(), file: useId() };

  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [language, setLanguage] = useState<TextSourceLanguage>("en");
  // Once the learner picks a language, stop guessing it from the text.
  const [languageChosen, setLanguageChosen] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [voice, setVoice] = useState(DEFAULT_VOICE);
  const [progress, setProgress] = useState<GenerationStage | null>(null);
  const nextKey = useRef(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const [notice, setNotice] = useState<{
    message: string;
    success: boolean;
    /** A practice was saved: offer the way to My materials. */
    created?: boolean;
  } | null>(null);

  const chars = countChars([text]);
  const tooLong = chars > PRACTICE_LIMITS.textChars;

  function changeText(value: string) {
    setText(value);
    if (!languageChosen && value.trim()) setLanguage(detectTextLanguage(value));
  }

  async function loadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // choosing the same file again still fires
    if (!file) return;
    setNotice(null);
    if (!/\.txt$/i.test(file.name) && file.type !== "text/plain") {
      setError({ key: "file-type" });
      return;
    }
    if (file.size > PRACTICE_LIMITS.fileBytes) {
      setError({ key: "file-too-large" });
      return;
    }
    try {
      const content = (await file.text()).replace(/^\uFEFF/, "");
      // Big5 or other non-UTF-8 files decode with replacement characters.
      if (content.includes("\uFFFD")) {
        setError({ key: "file-encoding" });
        return;
      }
      setError(null);
      changeText(content);
      if (!title.trim()) setTitle(titleFromFileName(file.name));
      setNotice({
        message: t("fileLoaded", { name: file.name }),
        success: false,
      });
    } catch {
      setError({ key: "file-read" });
    }
  }

  async function split() {
    setPending(true);
    setError(null);
    setNotice(null);
    const result = await prepare(text, language).catch((): PrepareResult => ({
      ok: false,
      reason: "failed",
    }));
    setPending(false);
    if (!result.ok) {
      setError({ key: result.reason });
      return;
    }
    setRows(result.sentences.map((s) => ({ ...s, key: nextKey.current++ })));
  }

  async function submit() {
    if (!rows) return;
    setPending(true);
    setError(null);
    const result = await create({
      title,
      sourceLanguage: language,
      voice,
      sentences: rows.map(({ en, zh }) => ({ en, zh })),
    }).catch((): CreatePracticeResult => ({ ok: false, reason: "failed" }));
    if (!result.ok) {
      setPending(false);
      setError(
        result.reason === "invalid"
          ? { key: result.problem, sentence: result.sentence }
          : { key: result.reason },
      );
      return;
    }
    // Saved: now make its notes and audio. Whatever happens, the practice
    // is kept and My materials can continue.
    const ready = await prepareForPractice(
      { generate, generateNotes },
      result.id,
      false,
      setProgress,
    );
    setPending(false);
    setProgress(null);
    const createdTitle = title.trim();
    setNotice(
      ready.ok
        ? {
            message: t("created", { title: createdTitle }),
            success: true,
            created: true,
          }
        : {
            message: `${t("createdIncomplete", { title: createdTitle })} ${t(`${ready.stage === "notes" ? "notesErrors" : "audioErrors"}.${ready.reason}`)}`,
            success: false,
            created: true,
          },
    );
    setTitle("");
    setText("");
    setLanguageChosen(false);
    setRows(null);
    router.refresh();
  }

  function editRow(key: number, field: keyof DraftSentence, value: string) {
    setRows(
      (current) =>
        current?.map((row) =>
          row.key === key ? { ...row, [field]: value } : row,
        ) ?? null,
    );
  }

  const errorMessage = error && (
    <p role="alert" className="text-supporting text-error">
      {t(`errors.${error.key}`, {
        max:
          error.key === "too-long"
            ? PRACTICE_LIMITS.textChars
            : error.key === "too-many"
              ? PRACTICE_LIMITS.sentences
              : error.key === "title"
                ? PRACTICE_LIMITS.titleChars
                : PRACTICE_LIMITS.sentenceChars,
        n:
          "sentence" in error && error.sentence !== undefined
            ? error.sentence + 1
            : 0,
      })}
    </p>
  );

  const titleField = (
    <div className="space-y-2">
      <label htmlFor={ids.title} className="block font-medium">
        {t("titleLabel")}
      </label>
      <input
        id={ids.title}
        type="text"
        value={title}
        maxLength={PRACTICE_LIMITS.titleChars}
        onChange={(event) => setTitle(event.target.value)}
        disabled={pending}
        className={fieldClassName}
      />
    </div>
  );

  if (rows) {
    return (
      <section aria-labelledby={`${ids.title}-review`} className="space-y-6">
        {titleField}
        <div className="pt-6">
          <h2 id={`${ids.title}-review`} className="font-display text-h2">
            {t("reviewTitle")}
          </h2>
          <p className="mt-2 text-ink-muted">{t("reviewIntro")}</p>
          <p className="mt-2 text-supporting text-ink-muted">
            {t("sentenceCount", { count: rows.length })}
          </p>
        </div>
        <ol className="divide-y divide-line border-y border-line">
          {rows.map((row, index) => (
            <li key={row.key} className="flex gap-4 py-4">
              <span
                aria-hidden="true"
                className="w-6 shrink-0 pt-3 text-metadata text-ink-muted tabular-nums"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <textarea
                  aria-label={t("sentenceEn", { n: index + 1 })}
                  lang="en"
                  rows={2}
                  value={row.en}
                  onChange={(event) =>
                    editRow(row.key, "en", event.target.value)
                  }
                  disabled={pending}
                  className={`${fieldClassName} resize-y text-sentence`}
                />
                <textarea
                  aria-label={t("sentenceZh", { n: index + 1 })}
                  lang="zh-Hant"
                  rows={1}
                  value={row.zh}
                  onChange={(event) =>
                    editRow(row.key, "zh", event.target.value)
                  }
                  disabled={pending}
                  className={`${fieldClassName} resize-y text-supporting`}
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                aria-label={t("removeSentenceLabel", { n: index + 1 })}
                onClick={() =>
                  setRows(
                    (current) =>
                      current?.filter((r) => r.key !== row.key) ?? null,
                  )
                }
                disabled={pending}
                className="mt-1"
              >
                {t("removeSentence")}
              </Button>
            </li>
          ))}
        </ol>
        <Button
          size="sm"
          onClick={() =>
            setRows((current) => [
              ...(current ?? []),
              { en: "", zh: "", key: nextKey.current++ },
            ])
          }
          disabled={pending || rows.length >= PRACTICE_LIMITS.sentences}
        >
          {t("addSentence")}
        </Button>
        <section
          aria-labelledby={`${ids.title}-voice`}
          className="space-y-3 pt-6"
        >
          <h3 id={`${ids.title}-voice`} className="font-display text-h3">
            {t("voiceTitle")}
          </h3>
          <VoicePicker
            value={voice}
            onChange={setVoice}
            sampleUrl={voiceSampleUrl}
            disabled={pending}
          />
          <p className="text-supporting text-ink-muted">{t("voiceNote")}</p>
        </section>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" onClick={submit} disabled={pending}>
            {pending ? t("creating") : t("create")}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setRows(null);
              setError(null);
            }}
            disabled={pending}
          >
            {t("back")}
          </Button>
        </div>
        {progress && (
          <p
            role="status"
            className="text-supporting text-ink-muted tabular-nums"
          >
            {progress.stage === "notes"
              ? t("generatingNotes")
              : t("generating", {
                  voiced: progress.voiced,
                  total: progress.total,
                })}
          </p>
        )}
        {errorMessage}
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {titleField}
      <div className="space-y-2">
        <label htmlFor={ids.text} className="block font-medium">
          {t("textLabel")}
        </label>
        <p id={ids.hint} className="text-supporting text-ink-muted">
          {t("textHint")}
        </p>
        <div>
          <input
            id={ids.file}
            type="file"
            accept=".txt,text/plain"
            onChange={loadFile}
            disabled={pending}
            className="peer sr-only"
          />
          <label
            htmlFor={ids.file}
            className={`${buttonClassName({ variant: "secondary", size: "sm", as: "link" })} cursor-pointer peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus peer-focus-visible:outline-solid`}
          >
            {t("chooseFile")}
          </label>
        </div>
        <textarea
          id={ids.text}
          aria-describedby={ids.hint}
          rows={10}
          value={text}
          onChange={(event) => changeText(event.target.value)}
          disabled={pending}
          className={`${fieldClassName} resize-y`}
        />
        <p
          className={`text-metadata tabular-nums ${tooLong ? "text-error" : "text-ink-muted"}`}
        >
          {t("charCount", { count: chars, max: PRACTICE_LIMITS.textChars })}
        </p>
      </div>
      <div className="space-y-2">
        <p aria-hidden="true" className="font-medium">
          {t("languageLegend")}
        </p>
        <SegmentedControl
          legend={t("languageLegend")}
          value={language}
          options={[
            { value: "en", label: t("languages.en") },
            { value: "zh", label: t("languages.zh") },
          ]}
          onChange={(value) => {
            setLanguage(value);
            setLanguageChosen(true);
          }}
          optionWidthClassName="min-w-16"
        />
        <p className="text-supporting text-ink-muted">
          {t(`languageNote.${language}`)}
        </p>
      </div>
      <Button
        variant="primary"
        arrow
        onClick={split}
        disabled={pending || !text.trim() || tooLong}
      >
        {pending ? t("preparing") : t("prepare")}
      </Button>
      {errorMessage}
      {notice && (
        <p
          role="status"
          className={`text-supporting ${notice.success ? "text-success" : "text-ink-muted"}`}
        >
          {notice.message}
        </p>
      )}
      {notice?.created && (
        <Link
          href="/materials"
          className="inline-block text-supporting text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink"
        >
          {t("backToMaterials")}
        </Link>
      )}
    </div>
  );
}
