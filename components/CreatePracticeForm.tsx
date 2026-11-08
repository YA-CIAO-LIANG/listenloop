"use client";

import { SUBTITLE_MAX } from "@/lib/videos";
import { oneLineTitle } from "@/lib/titles";
import type { UsageBlock } from "@/lib/usage";
import { UsageLimitMessage } from "./UsageLimitMessage";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import {
  addMeasurement,
  estimateSeconds,
  LONG_JOB_SECONDS,
  remainingSeconds,
  roundForDisplay,
  secondsPerSentence,
} from "@/lib/custom-practice/estimate";
import { useMeasuredSpeed, useNow } from "./useGenerationEstimate";
import {
  describeDraft,
  createPractice,
  generatePracticeAudio,
  generatePracticeNotes,
  splitText,
  translateSentences,
  type CreatePracticeResult,
} from "@/app/materials/actions";
import {
  DEFAULT_VOICE,
  canSplitAt,
  mergeWithNext,
  PRACTICE_LIMITS,
  splitRowAt,
  titleFromFileName,
  type DraftSentence,
} from "@/lib/custom-practice/draft";
import {
  detectTextLanguage,
  type TextSourceLanguage,
} from "@/lib/custom-practice/split";
import { countChars } from "@/lib/usage";
import {
  prepareDraft,
  prepareForPractice,
  stagePercent,
  type GenerateAudio,
  type GenerateNotes,
  type PrepareDraftResult,
  type SplitText,
  type Stage,
  type TranslateSentences,
} from "./practice-generation";
import { Button, buttonClassName } from "./Button";
import {
  GenerateTextPanel,
  type GeneratedPractice,
  type GenerateText,
} from "./GenerateTextPanel";
import { SpeakerToggle } from "./SpeakerToggle";
import type { MaterialMeta } from "@/lib/custom-practice/generation";
import { SegmentedControl } from "./SegmentedControl";
import { RevisePanel, type ReviseText } from "./RevisePanel";
import { YouTubeCreate } from "./YouTubeCreate";
import { StageProgress } from "./StageProgress";
import { UNDO_STEPS } from "@/lib/custom-practice/revise";
import { VoiceMenu, voiceSampleUrl } from "./VoiceMenu";
import type { PlanBlock } from "@/lib/plans";

type CreatePracticeFormProps = {
  /** Injected in tests; the Server Actions otherwise. */
  split?: SplitText;
  translate?: TranslateSentences;
  /** Injected in tests; the Server Action otherwise (D96). */
  revise?: ReviseText;
  /** Offer making a practice from a YouTube video (D97). */
  youtube?: boolean;
  create?: (draft: {
    titleEn: string;
    titleZh: string;
    subtitle?: string;
    sourceLanguage: TextSourceLanguage;
    voice: string;
    voiceB?: string;
    sentences: DraftSentence[];
    meta?: MaterialMeta | null;
    official?: boolean;
  }) => Promise<CreatePracticeResult>;
  /** Writes the missing title and the subtitle of pasted text (D83). */
  describe?: typeof describeDraft;
  generate?: GenerateAudio;
  generateNotes?: GenerateNotes;
  generateText?: GenerateText;
  /** An admin making an official material (D80): saved as its draft. */
  official?: boolean;
};

type FormError =
  | {
      key: Exclude<PrepareDraftResult, { ok: true }>["reason"];
      max?: number;
      /** For limit: which allowance ran out (D77). */
      usage?: UsageBlock;
    }
  | { key: "plan"; limit: PlanBlock["limit"]; max?: number }
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
  split = splitText,
  translate = translateSentences,
  revise,
  create = createPractice,
  generate = generatePracticeAudio,
  generateNotes = generatePracticeNotes,
  generateText,
  describe = describeDraft,
  official = false,
  youtube = false,
}: CreatePracticeFormProps) {
  const tPlans = useTranslations("plans");
  const tSpeakers = useTranslations("speakers");
  const t = useTranslations("create");
  const router = useRouter();
  const ids = { title: useId(), text: useId(), hint: useId(), file: useId() };

  const tGenerate = useTranslations("generate");
  // Paste or upload text, or have it written (e+ 5).
  const [source, setSource] = useState<"text" | "ai" | "youtube">("text");
  // Both titles and the subtitle (D83): typed ones are kept exactly.
  const [titleEn, setTitleEn] = useState("");
  const [titleZh, setTitleZh] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const shownTitle = oneLineTitle({
    en: titleEn.trim() || titleZh.trim(),
    zh: titleEn.trim() ? titleZh.trim() || null : null,
  });
  const [text, setText] = useState("");
  const [language, setLanguage] = useState<TextSourceLanguage>("en");
  // How long getting ready takes on this device (D95).
  const [speed, saveSpeed] = useMeasuredSpeed();
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const preparing = useRef<string | null>(null);
  const now = useNow(startedAt !== null);
  // Closing or leaving the page midway: the server finishes the job.
  useEffect(() => {
    const onHide = () => {
      if (preparing.current && typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon(`/materials/${preparing.current}/prepare`);
      }
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, []);
  // Once the learner picks a language, stop guessing it from the text.
  const [languageChosen, setLanguageChosen] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  // Drafts before each "revise with an instruction" (D96), newest last.
  const [undoStack, setUndoStack] = useState<Row[][]>([]);
  const [voice, setVoice] = useState(DEFAULT_VOICE);
  // Speaker B's voice, used when the sentences have speakers (D57).
  const [voiceB, setVoiceB] = useState("us-male");
  // Where AI-written text belongs, saved with the practice (D57).
  const [meta, setMeta] = useState<MaterialMeta | null>(null);
  const [progress, setProgress] = useState<Stage | null>(null);
  const nextKey = useRef(0);
  // Each row's cursor in its English box, for "Split at cursor".
  const [carets, setCarets] = useState<Record<number, number>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const [notice, setNotice] = useState<{
    message: string;
    success: boolean;
    /** A practice was saved: offer the way to My materials. */
    created?: boolean;
    /** Notes or audio stopped at a limit: which one (D77). */
    usage?: UsageBlock;
  } | null>(null);

  const chars = countChars([text]);
  // Sentences with speakers make a two-voice dialogue (D57).
  const dialogue = rows?.some((row) => row.speaker !== undefined) ?? false;
  const tooLong = chars > PRACTICE_LIMITS.textChars;

  function changeText(value: string) {
    setText(value);
    if (!languageChosen && value.trim()) setLanguage(detectTextLanguage(value));
  }

  /** Written text goes into the form to review and edit (it's English). */
  function applyGenerated(generated: GeneratedPractice) {
    setTitleEn(generated.titleEn);
    setTitleZh(generated.titleZh);
    setSubtitle(generated.subtitle);
    setText(generated.text);
    setMeta(generated.meta);
    // The accent asked for: A a female voice, B a male one (D57).
    setVoice(`${generated.accent}-female`);
    setVoiceB(`${generated.accent}-male`);
    setLanguage("en");
    setLanguageChosen(true);
    setSource("text");
    setNotice({
      message: tGenerate("generated", {
        title: oneLineTitle({ en: generated.titleEn, zh: generated.titleZh }),
      }),
      success: false,
    });
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
      setMeta(null);
      changeText(content);
      // A file's name is a title in its own language (D83).
      if (!titleEn.trim() && !titleZh.trim()) {
        const name = titleFromFileName(file.name);
        if (/\p{Script=Han}/u.test(name)) setTitleZh(name);
        else setTitleEn(name);
      }
      setNotice({
        message: t("fileLoaded", { name: file.name }),
        success: false,
      });
    } catch {
      setError({ key: "file-read" });
    }
  }

  async function prepare() {
    setPending(true);
    setError(null);
    setNotice(null);
    const result = await prepareDraft(
      { split, translate },
      text,
      language,
      setProgress,
    );
    setPending(false);
    setProgress(null);
    if (!result.ok) {
      setError({
        key: result.reason,
        max: result.max,
        usage: result.limit,
      });
      return;
    }
    // The missing title and the subtitle (D83), unless AI wrote them
    // already. One call; what's typed is kept. If it fails, the learner
    // types them in the review step instead.
    if (!(titleEn.trim() && titleZh.trim() && subtitle.trim())) {
      const described = await describe({
        titleEn,
        titleZh,
        sentences: result.sentences.map((s) => s.en),
      }).catch(() => null);
      if (described?.ok) {
        setTitleEn(described.titleEn);
        setTitleZh(described.titleZh);
        if (!subtitle.trim()) setSubtitle(described.subtitle);
      }
    }
    setRows(result.sentences.map((s) => ({ ...s, key: nextKey.current++ })));
  }

  async function submit() {
    if (!rows) return;
    setPending(true);
    setError(null);
    const result = await create({
      titleEn,
      titleZh,
      subtitle,
      sourceLanguage: language,
      voice,
      ...(dialogue ? { voiceB } : {}),
      sentences: rows.map(({ en, zh, speaker }) =>
        dialogue ? { en, zh, speaker: speaker ?? 0 } : { en, zh },
      ),
      meta,
      ...(official ? { official: true } : {}),
    }).catch((): CreatePracticeResult => ({ ok: false, reason: "failed" }));
    if (!result.ok) {
      setPending(false);
      setError(
        result.reason === "invalid"
          ? { key: result.problem, sentence: result.sentence }
          : result.reason === "plan"
            ? { key: "plan", limit: result.limit, max: result.max }
            : { key: result.reason, usage: result.usage },
      );
      return;
    }
    // Saved: now make its notes and audio. Whatever happens, the practice
    // is kept and My materials can continue. If the page goes away
    // midway, the server carries on (D95).
    preparing.current = result.id;
    setStartedAt(Date.now());
    const began = performance.now();
    const ready = await prepareForPractice(
      { generate, generateNotes },
      { id: result.id, notesReady: false, total: rows.length },
      setProgress,
    );
    preparing.current = null;
    if (ready.ok) {
      saveSpeed(
        addMeasurement(speed, (performance.now() - began) / 1000, rows.length),
      );
    }
    setPending(false);
    setProgress(null);
    setStartedAt(null);
    const createdTitle = shownTitle;
    setNotice(
      ready.ok
        ? {
            message: t("created", { title: createdTitle }),
            success: true,
            created: true,
          }
        : {
            // With a limit's details, the reason is UsageLimitMessage's.
            message:
              ready.reason === "limit" && ready.limit
                ? t("createdIncomplete", { title: createdTitle })
                : `${t("createdIncomplete", { title: createdTitle })} ${t(`${ready.stage === "notes" ? "notesErrors" : "audioErrors"}.${ready.reason}`)}`,
            usage: ready.reason === "limit" ? ready.limit : undefined,
            success: false,
            created: true,
          },
    );
    setTitleEn("");
    setTitleZh("");
    setSubtitle("");
    setText("");
    setLanguageChosen(false);
    setRows(null);
    setUndoStack([]);
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
      {error.key === "plan" ? (
        tPlans(`limits.${error.limit}`, { max: error.max ?? 0 })
      ) : error.key === "limit" && "usage" in error && error.usage ? (
        <UsageLimitMessage block={error.usage} fallback={t("errors.limit")} />
      ) : (
        t(`errors.${error.key}`, {
          max:
            "max" in error && error.max !== undefined
              ? error.max
              : error.key === "too-long"
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
        })
      )}
    </p>
  );

  // Both titles first (D82, D83): each optional; what's typed is kept
  // exactly, the other language is written. The review step adds the
  // subtitle, and everything stays editable.
  const titleField = (
    <fieldset className="space-y-3">
      <legend className="font-medium">{t("titlesLegend")}</legend>
      <p id={`${ids.title}-hint`} className="text-supporting text-ink-muted">
        {tGenerate("titleHint")}
      </p>
      <div className="grid gap-3 split:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor={ids.title} className="block text-supporting">
            {t("titleEnLabel")}
          </label>
          <input
            id={ids.title}
            type="text"
            lang="en"
            value={titleEn}
            maxLength={PRACTICE_LIMITS.titleChars}
            aria-describedby={`${ids.title}-hint`}
            onChange={(event) => setTitleEn(event.target.value)}
            disabled={pending}
            className={fieldClassName}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${ids.title}-zh`} className="block text-supporting">
            {t("titleZhLabel")}
          </label>
          <input
            id={`${ids.title}-zh`}
            type="text"
            value={titleZh}
            maxLength={PRACTICE_LIMITS.titleChars}
            aria-describedby={`${ids.title}-hint`}
            onChange={(event) => setTitleZh(event.target.value)}
            disabled={pending}
            className={fieldClassName}
          />
        </div>
      </div>
      {rows && (
        <div className="space-y-1">
          <label
            htmlFor={`${ids.title}-subtitle`}
            className="block text-supporting"
          >
            {t("subtitleLabel")}
          </label>
          <input
            id={`${ids.title}-subtitle`}
            type="text"
            value={subtitle}
            maxLength={SUBTITLE_MAX}
            onChange={(event) => setSubtitle(event.target.value)}
            disabled={pending}
            className={fieldClassName}
          />
        </div>
      )}
    </fieldset>
  );

  // Getting ready: notes and audio for each sentence (D95).
  const estimate = estimateSeconds(
    rows?.length ?? 0,
    secondsPerSentence(speed),
  );
  const duration = (seconds: number) => t("duration", roundForDisplay(seconds));

  if (rows) {
    return (
      <section aria-labelledby={`${ids.title}-review`} className="space-y-6">
        {titleField}
        <div className="pt-6">
          <h2 id={`${ids.title}-review`} className="font-display text-h2">
            {t("reviewTitle")}
          </h2>
          <p className="mt-2 text-ink-muted">{t("reviewIntro")}</p>
          <p
            id={`${ids.title}-split-hint`}
            className="mt-2 text-supporting text-ink-muted"
          >
            {t("splitHint")}
          </p>
          <p className="mt-2 text-supporting text-ink-muted">
            {t("sentenceCount", { count: rows.length })}
          </p>
        </div>
        {/* AI changes the English by an instruction (D96). */}
        <RevisePanel
          sentences={rows}
          dialogue={dialogue}
          disabled={pending}
          canUndo={undoStack.length > 0}
          translate={translate}
          revise={revise}
          onRevised={(next) => {
            setUndoStack((stack) => [...stack, rows].slice(-UNDO_STEPS));
            setRows(next.map((s) => ({ ...s, key: nextKey.current++ })));
          }}
          onUndo={() => {
            const previous = undoStack.at(-1);
            if (!previous) return;
            setUndoStack((stack) => stack.slice(0, -1));
            setRows(previous);
          }}
        />
        <ol className="divide-y divide-line border-y border-line">
          {rows.map((row, index) => (
            <li key={row.key} className="flex gap-4 py-4">
              <div className="flex shrink-0 flex-col items-center gap-2">
                <span
                  aria-hidden="true"
                  className="w-6 pt-3 text-metadata text-ink-muted tabular-nums"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                {dialogue && (
                  <SpeakerToggle
                    speaker={row.speaker ?? 0}
                    index={index}
                    disabled={pending}
                    onChange={(speaker) =>
                      setRows(
                        (current) =>
                          current?.map((r) =>
                            r.key === row.key ? { ...r, speaker } : r,
                          ) ?? null,
                      )
                    }
                  />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <textarea
                  aria-label={t("sentenceEn", { n: index + 1 })}
                  aria-describedby={`${ids.title}-split-hint`}
                  lang="en"
                  rows={2}
                  value={row.en}
                  onChange={(event) =>
                    editRow(row.key, "en", event.target.value)
                  }
                  onSelect={(event) => {
                    const at = event.currentTarget.selectionStart;
                    setCarets((current) => ({ ...current, [row.key]: at }));
                  }}
                  disabled={pending}
                  className={`${fieldClassName} resize-y text-sentence`}
                />
                <textarea
                  aria-label={t("sentenceZh", { n: index + 1 })}
                  lang="zh-Hant"
                  rows={1}
                  value={row.zh}
                  placeholder={t("zhPlaceholder")}
                  onChange={(event) =>
                    editRow(row.key, "zh", event.target.value)
                  }
                  disabled={pending}
                  className={`${fieldClassName} resize-y text-supporting`}
                />
                <div className="flex flex-wrap gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={t("splitSentenceLabel", { n: index + 1 })}
                    onClick={() =>
                      setRows(
                        (current) =>
                          current &&
                          splitRowAt(
                            current,
                            index,
                            carets[row.key] ?? 0,
                            (en) => ({
                              en,
                              zh: "",
                              key: nextKey.current++,
                              ...(row.speaker === undefined
                                ? {}
                                : { speaker: row.speaker }),
                            }),
                          ),
                      )
                    }
                    disabled={
                      pending ||
                      rows.length >= PRACTICE_LIMITS.sentences ||
                      !canSplitAt(row.en, carets[row.key] ?? 0)
                    }
                  >
                    {t("splitSentence")}
                  </Button>
                  {index < rows.length - 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={t("mergeSentenceLabel", { n: index + 1 })}
                      onClick={() =>
                        setRows(
                          (current) => current && mergeWithNext(current, index),
                        )
                      }
                      disabled={pending}
                    >
                      {t("mergeSentence")}
                    </Button>
                  )}
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
                  >
                    {t("removeSentence")}
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ol>
        <Button
          size="sm"
          onClick={() =>
            setRows((current) => {
              const last = current?.at(-1);
              return [
                ...(current ?? []),
                {
                  en: "",
                  zh: "",
                  key: nextKey.current++,
                  // In a dialogue, the next line goes to the other speaker.
                  ...(dialogue ? { speaker: last?.speaker === 0 ? 1 : 0 } : {}),
                },
              ];
            })
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
          {dialogue && <p className="font-medium">{tSpeakers("voiceA")}</p>}
          <VoiceMenu
            value={voice}
            onChange={setVoice}
            sampleUrl={voiceSampleUrl}
            disabled={pending}
          />
          {dialogue && (
            <>
              <p className="font-medium">{tSpeakers("voiceB")}</p>
              <VoiceMenu
                value={voiceB}
                onChange={setVoiceB}
                sampleUrl={voiceSampleUrl}
                disabled={pending}
              />
            </>
          )}
          <p className="text-supporting text-ink-muted">
            {dialogue ? tSpeakers("note") : t("voiceNote")}
          </p>
        </section>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" onClick={submit} disabled={pending}>
            {pending ? t("creating") : t("create")}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setRows(null);
              setUndoStack([]);
              setError(null);
            }}
            disabled={pending}
          >
            {t("back")}
          </Button>
        </div>
        {/* The time it should take (D95): before, then what's left. */}
        <p className="text-supporting text-ink-muted">
          {startedAt !== null && progress && progress.stage !== "split"
            ? t("remaining", {
                time: duration(
                  remainingSeconds(
                    stagePercent(progress) / 100,
                    Math.max(0, (now - startedAt) / 1000),
                    estimate,
                  ),
                ),
              })
            : t("estimate", { time: duration(estimate) })}
          {estimate > LONG_JOB_SECONDS && (
            <>
              {" "}
              {t("longJob")}{" "}
              <Link
                href="/materials"
                className="text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink"
              >
                {t("toMaterials")}
              </Link>
            </>
          )}
        </p>
        {progress && <StageProgress stage={progress} className="max-w-sm" />}
        {errorMessage}
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {/* The title first (D82), then where the text comes from. */}
      {titleField}
      <div className="space-y-2">
        <p aria-hidden="true" className="font-medium">
          {tGenerate("sourceLegend")}
        </p>
        <SegmentedControl
          legend={tGenerate("sourceLegend")}
          value={source}
          options={[
            { value: "text", label: tGenerate("sources.text") },
            { value: "ai", label: tGenerate("sources.ai") },
            // From a YouTube video (D97), when it's set up.
            ...(youtube
              ? [
                  {
                    value: "youtube" as const,
                    label: tGenerate("sources.youtube"),
                  },
                ]
              : []),
          ]}
          onChange={(value) => {
            setSource(value);
            setError(null);
          }}
          optionWidthClassName="min-w-16"
        />
      </div>
      {source === "youtube" ? (
        <YouTubeCreate />
      ) : source === "ai" ? (
        <GenerateTextPanel
          titles={{ en: titleEn, zh: titleZh }}
          generate={generateText}
          onGenerated={applyGenerated}
        />
      ) : (
        <>
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
            onClick={prepare}
            disabled={pending || !text.trim() || tooLong}
          >
            {pending ? t("preparing") : t("prepare")}
          </Button>
          {progress && <StageProgress stage={progress} className="max-w-sm" />}
        </>
      )}
      {errorMessage}
      {notice && (
        <p
          role="status"
          className={`text-supporting ${notice.success ? "text-success" : "text-ink-muted"}`}
        >
          {notice.message}
          {notice.usage && (
            <>
              {" "}
              <UsageLimitMessage block={notice.usage} fallback="" />
            </>
          )}
        </p>
      )}
      {notice?.created && (
        <Link
          href={official ? "/admin/official" : "/materials"}
          className="inline-block text-supporting text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink"
        >
          {official ? t("backToOfficial") : t("backToMaterials")}
        </Link>
      )}
    </div>
  );
}
