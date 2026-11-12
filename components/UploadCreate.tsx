"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { recordIntent } from "@/app/intent-actions";
import {
  generatePracticeAudio,
  generatePracticeNotes,
  translateSentences,
  type TranslateResult,
} from "@/app/materials/actions";
import {
  createUploadPractice,
  startAudioUpload,
  transcribeAudio,
  type CreateUploadResult,
  type StartUploadResult,
  type TranscribeResult,
} from "@/app/materials/upload-actions";
import { TRANSLATE_BATCH } from "@/lib/custom-practice/notes";
import { can, PLANS } from "@/lib/plans";
import { customPracticeId } from "@/lib/practice-material";
import { QUEUE } from "@/lib/queue";
import { loadBrowserSupabase } from "@/lib/supabase/browser";
import { UPLOADS_BUCKET } from "@/lib/supabase/config";
import {
  encodeWav,
  findSpeechSegments,
  formatSeconds,
  heardSentences,
  isUploadFile,
  parseSeconds,
  segmentBatches,
  sliceSamples,
  UPLOAD_ACCEPT,
  UPLOAD_LIMITS,
  uploadLimits,
  type HeardSegment,
} from "@/lib/upload-audio";
import { excerptSeconds, type TimedSentence } from "@/lib/youtube";
import { Button } from "./Button";
import { ButtonLink } from "./ButtonLink";
import { usePlan } from "./PlanProvider";
import { ProgressBar } from "./ProgressBar";
import { prepareForPractice, type Stage } from "./practice-generation";
import { StageProgress } from "./StageProgress";
import { decodeToMono, encodeMp3, mediaSeconds } from "./upload/browser-audio";

const fieldClassName =
  "block w-full rounded-base border border-line bg-surface px-4 py-3 focus-visible:border-accent";
const timeClassName =
  "h-10 w-24 rounded-base border border-line bg-surface px-3 tabular-nums pointer-coarse:min-h-11";

type Row = TimedSentence & { zh: string };

/** The browser's part (D130), injected in tests. */
export type BrowserAudio = {
  duration: (file: Blob) => Promise<number | null>;
  decode: (file: Blob) => Promise<Float32Array>;
  encode: (
    samples: Float32Array,
    onProgress?: (share: number) => void,
  ) => Promise<Blob>;
  /** Uploads to the signed URL; false when it didn't work. */
  upload: (path: string, token: string, file: Blob) => Promise<boolean>;
};

async function uploadRecording(path: string, token: string, file: Blob) {
  const supabase = await loadBrowserSupabase().catch(() => null);
  if (!supabase) return false;
  const { error } = await supabase.storage
    .from(UPLOADS_BUCKET)
    .uploadToSignedUrl(path, token, file, {
      contentType: "audio/mpeg",
      // The file never changes: browsers and the CDN may keep it (D130).
      cacheControl: "31536000",
    });
  return !error;
}

const BROWSER_AUDIO: BrowserAudio = {
  duration: mediaSeconds,
  decode: decodeToMono,
  encode: encodeMp3,
  upload: uploadRecording,
};

type Phase =
  | { step: "decode" }
  | { step: "encode"; share: number }
  | { step: "upload" }
  | { step: "transcribe"; done: number; total: number }
  | { step: "queued"; ahead: number };

/**
 * A practice from the learner's own MP3 or MP4 (D130): the browser takes
 * out the sound and uploads it as a small MP3, speech to text writes it
 * down with each sentence's times, the learner checks the words and times
 * (listening to each sentence), and it's translated and saved like any
 * practice. Practicing plays the recording itself. Plus and up; others
 * see what it is and the plans (and opening it is recorded as interest).
 */
export function UploadCreate({
  start = startAudioUpload,
  transcribe = transcribeAudio,
  create = createUploadPractice,
  translate = translateSentences,
  generateNotes = generatePracticeNotes,
  generate = generatePracticeAudio,
  record = recordIntent,
  browser = BROWSER_AUDIO,
  wait = (seconds: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, seconds * 1000)),
}: {
  /** Injected in tests; the Server Actions and browser APIs otherwise. */
  start?: (input: unknown) => Promise<StartUploadResult>;
  transcribe?: (form: FormData) => Promise<TranscribeResult>;
  create?: (input: unknown) => Promise<CreateUploadResult>;
  translate?: (s: string[], l: "en") => Promise<TranslateResult>;
  generateNotes?: typeof generatePracticeNotes;
  generate?: typeof generatePracticeAudio;
  record?: typeof recordIntent;
  browser?: BrowserAudio;
  /** Waits between asks while in line; injected in tests. */
  wait?: (seconds: number) => Promise<void>;
}) {
  const t = useTranslations("upload");
  const tPlans = useTranslations("plans");
  const router = useRouter();
  const plan = usePlan();
  const fileId = useId();
  const hintId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase | null>(null);
  const [recording, setRecording] = useState<{
    path: string;
    seconds: number;
    url: string;
  } | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [translated, setTranslated] = useState(false);
  const [titleEn, setTitleEn] = useState("");
  const [titleZh, setTitleZh] = useState("");
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState<Stage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const allowed = can(plan, { kind: "upload-audio" }).ok;
  const limits = uploadLimits(plan);

  // A free plan opening this is interest in paying (D129, D130).
  const recorded = useRef(false);
  useEffect(() => {
    if (allowed || recorded.current) return;
    recorded.current = true;
    void record({
      step: "unlock_click",
      item: "upload-practice",
      source: "upload",
    }).catch(() => {});
  }, [allowed, record]);

  // Each sentence plays from the recording on this device.
  const player = useRef<HTMLAudioElement | null>(null);
  const watch = useRef(0);
  const [playing, setPlaying] = useState<number | null>(null);
  useEffect(
    () => () => {
      cancelAnimationFrame(watch.current);
      player.current?.pause();
      if (recording) URL.revokeObjectURL(recording.url);
    },
    [recording],
  );

  if (!allowed) {
    return (
      <div className="space-y-3 rounded-base border border-line bg-surface p-4">
        <p>{t("paidOnly")}</p>
        <ButtonLink href="/pricing?from=upload" variant="secondary" arrow>
          {t("seePlans")}
        </ButtonLink>
      </div>
    );
  }

  const duration = (seconds: number) =>
    t("duration", {
      minutes: Math.floor(seconds / 60),
      seconds: Math.round(seconds % 60),
    });

  const fail = (message: string) => {
    setPhase(null);
    setPending(false);
    setError(message);
  };

  /** A server action's refusal as a message. */
  const refusal = (result: { reason: string; limit?: string; max?: number }) =>
    result.reason === "plan" && result.limit
      ? tPlans(`limits.${result.limit}` as "limits.uploadAudio", {
          max: result.max ?? 0,
        })
      : t(
          `errors.${
            (
              [
                "unavailable",
                "busy",
                "limit",
                "too-big",
                "too-long",
                "invalid",
                "config",
                "queued",
              ] as const
            ).find((reason) => reason === result.reason) ?? "failed"
          }`,
          {
            max:
              result.reason === "too-big"
                ? Math.round(limits.bytes / 1024 / 1024)
                : duration(limits.seconds),
          },
        );

  async function read() {
    if (!file) return;
    setError(null);
    if (!isUploadFile(file)) return fail(t("errors.type"));
    if (file.size > limits.bytes) {
      return fail(
        t("errors.too-big", { max: Math.round(limits.bytes / 1024 / 1024) }),
      );
    }
    setPending(true);
    const tooLong = (seconds: number) =>
      t("errors.too-long", {
        length: duration(seconds),
        max: duration(limits.seconds),
      });
    const known = await browser.duration(file).catch(() => null);
    if (known !== null && known > limits.seconds + 1) {
      return fail(tooLong(known));
    }
    setPhase({ step: "decode" });
    let samples: Float32Array;
    try {
      samples = await browser.decode(file);
    } catch {
      return fail(t("errors.decode"));
    }
    const rate = UPLOAD_LIMITS.sampleRate;
    const seconds = samples.length / rate;
    if (seconds > limits.seconds + 1) return fail(tooLong(seconds));
    const segments = findSpeechSegments(samples, rate);
    if (segments.length === 0) return fail(t("errors.silent"));

    setPhase({ step: "encode", share: 0 });
    const mp3 = await browser
      .encode(samples, (share) => setPhase({ step: "encode", share }))
      .catch(() => null);
    if (!mp3) return fail(t("errors.decode"));

    setPhase({ step: "upload" });
    const started = await start({
      sourceBytes: file.size,
      bytes: mp3.size,
      seconds,
    }).catch((): StartUploadResult => ({ ok: false, reason: "failed" }));
    if (!started.ok) return fail(refusal(started));
    if (!(await browser.upload(started.path, started.token, mp3))) {
      return fail(t("errors.upload"));
    }

    const batches = segmentBatches(segments);
    const heard: HeardSegment[] = [];
    for (const [n, batch] of batches.entries()) {
      setPhase({ step: "transcribe", done: n, total: batches.length });
      const form = new FormData();
      form.set("path", started.path);
      form.set("pieces", JSON.stringify(batch));
      if (n === batches.length - 1) form.set("last", "1");
      batch.forEach((piece, i) => {
        const wav = encodeWav(sliceSamples(samples, rate, piece), rate);
        form.set(
          `piece-${i}`,
          new Blob([wav as BlobPart], { type: "audio/wav" }),
          `piece-${i}.wav`,
        );
      });
      const ask = () =>
        transcribe(form).catch((): TranscribeResult => ({
          ok: false,
          reason: "failed",
        }));
      let result = await ask();
      // In line (D133): ask again every few seconds, up to a limit.
      for (
        let waited = 0;
        !result.ok &&
        result.reason === "queued" &&
        waited < QUEUE.maxWaitSeconds;
        waited += QUEUE.pollSeconds
      ) {
        setPhase({ step: "queued", ahead: result.ahead });
        await wait(QUEUE.pollSeconds);
        setPhase({ step: "transcribe", done: n, total: batches.length });
        result = await ask();
      }
      if (!result.ok) return fail(refusal(result));
      heard.push(...result.heard);
    }
    const sentences = heardSentences(heard);
    if (sentences.length === 0) return fail(t("errors.nothingHeard"));
    setPhase(null);
    setPending(false);
    setRecording({
      path: started.path,
      seconds,
      url: URL.createObjectURL(mp3),
    });
    setRows(sentences.map((s) => ({ ...s, zh: "" })));
    setTranslated(false);
    setTitleEn(sentences[0].en.slice(0, 60));
  }

  function play(index: number) {
    if (!recording || !rows) return;
    cancelAnimationFrame(watch.current);
    const audio = (player.current ??= new Audio(recording.url));
    if (playing === index) {
      audio.pause();
      setPlaying(null);
      return;
    }
    const row = rows[index];
    audio.currentTime = row.start;
    setPlaying(index);
    const check = () => {
      if (audio.currentTime >= row.end || audio.ended) {
        audio.pause();
        setPlaying(null);
        return;
      }
      watch.current = requestAnimationFrame(check);
    };
    void audio
      .play()
      .then(() => (watch.current = requestAnimationFrame(check)))
      .catch(() => setPlaying(null));
  }

  const update = (index: number, change: Partial<Row>) =>
    setRows(
      (current) =>
        current?.map((row, i) => (i === index ? { ...row, ...change } : row)) ??
        null,
    );

  function merge(index: number) {
    setRows((current) => {
      if (!current || index >= current.length - 1) return current;
      const [a, b] = [current[index], current[index + 1]];
      const joined: Row = {
        en: `${a.en} ${b.en}`,
        zh: [a.zh, b.zh].filter(Boolean).join(""),
        start: a.start,
        end: b.end,
      };
      return [...current.slice(0, index), joined, ...current.slice(index + 2)];
    });
  }

  function remove(index: number) {
    setRows((current) => current?.filter((_, i) => i !== index) ?? null);
  }

  /** The first sentence whose times or words won't do, or -1. */
  function badRow(list: Row[]): number {
    return list.findIndex(
      (row, i) =>
        !row.en.trim() ||
        !(row.end > row.start) ||
        row.start < 0 ||
        (recording !== null && row.end > recording.seconds + 1) ||
        (i > 0 && row.start < list[i - 1].start),
    );
  }

  async function translateRows() {
    if (!rows) return;
    const bad = badRow(rows);
    if (bad >= 0) {
      setError(t("errors.row", { n: bad + 1 }));
      return;
    }
    const length = excerptSeconds(rows);
    const max = PLANS[plan].maxPracticeSeconds;
    if (max !== null && length > max) {
      setError(
        t("errors.too-long", { length: duration(length), max: duration(max) }),
      );
      return;
    }
    setError(null);
    setPending(true);
    const translations: string[] = [];
    for (let at = 0; at < rows.length; at += TRANSLATE_BATCH) {
      setProgress({
        stage: "translate",
        done: translations.length,
        total: rows.length,
      });
      const result = await translate(
        rows.slice(at, at + TRANSLATE_BATCH).map((row) => row.en),
        "en",
      ).catch((): TranslateResult => ({ ok: false, reason: "failed" }));
      if (!result.ok) {
        setPending(false);
        setProgress(null);
        setError(
          t(result.reason === "limit" ? "errors.aiLimit" : "errors.failed"),
        );
        return;
      }
      translations.push(...result.translations);
    }
    setPending(false);
    setProgress(null);
    setRows(rows.map((row, i) => ({ ...row, zh: translations[i] ?? "" })));
    setTranslated(true);
  }

  async function save() {
    if (!rows || !recording) return;
    const bad = badRow(rows);
    if (bad >= 0) {
      setError(t("errors.row", { n: bad + 1 }));
      return;
    }
    setPending(true);
    setError(null);
    const result = await create({
      path: recording.path,
      seconds: recording.seconds,
      titleEn,
      titleZh,
      sentences: rows,
    }).catch((): CreateUploadResult => ({ ok: false, reason: "failed" }));
    if (!result.ok) {
      setPending(false);
      setError(refusal(result));
      return;
    }
    // Notes, as for any practice; the recording is the audio.
    const ready = await prepareForPractice(
      { generate, generateNotes },
      { id: result.id, notesReady: false, total: rows.length },
      setProgress,
    );
    setPending(false);
    setProgress(null);
    setCreatedId(result.id);
    if (!ready.ok) setError(t("errors.notes"));
    router.refresh();
  }

  if (createdId) {
    return (
      <div role="status" className="space-y-3">
        <p className="text-success">
          <span aria-hidden="true">✓ </span>
          {t("created", { title: titleEn || titleZh })}
        </p>
        {error && <p className="text-supporting text-error">{error}</p>}
        <p className="text-supporting text-ink-muted">{t("privateNote")}</p>
        <ButtonLink
          href={`/videos/${customPracticeId(createdId)}`}
          variant="primary"
          arrow
        >
          {t("open")}
        </ButtonLink>
      </div>
    );
  }

  const phaseLabel =
    phase?.step === "encode"
      ? t("phases.encode", { percent: Math.round(phase.share * 100) })
      : phase?.step === "transcribe"
        ? t("phases.transcribe", { done: phase.done, total: phase.total })
        : phase?.step === "queued"
          ? t("phases.queued", { ahead: phase.ahead })
          : phase
            ? t(`phases.${phase.step}`)
            : "";

  return (
    <div className="space-y-6">
      {!rows && (
        <div className="space-y-3">
          <label htmlFor={fileId} className="block font-medium">
            {t("fileLabel")}
          </label>
          <p id={hintId} className="text-supporting text-ink-muted">
            {t("fileHint", {
              mb: Math.round(limits.bytes / 1024 / 1024),
              length: duration(limits.seconds),
            })}
          </p>
          <input
            id={fileId}
            type="file"
            accept={UPLOAD_ACCEPT}
            aria-describedby={hintId}
            disabled={pending}
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setError(null);
            }}
            className="block w-full max-w-md text-supporting file:mr-3 file:min-h-11 file:rounded-base file:border file:border-line file:bg-surface file:px-4 file:font-medium file:text-ink"
          />
          <Button
            variant="primary"
            arrow
            onClick={read}
            disabled={pending || !file}
          >
            {t("read")}
          </Button>
          {phase && (
            <div className="max-w-sm">
              {phase.step === "transcribe" ? (
                <ProgressBar
                  value={phase.done}
                  max={phase.total}
                  label={phaseLabel}
                  showCount={false}
                />
              ) : (
                <p role="status" className="text-supporting text-ink-muted">
                  {phaseLabel}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {rows && recording && (
        <div className="space-y-4">
          <p className="text-supporting text-ink-muted">
            {t(translated ? "translatedIntro" : "reviewIntro", {
              count: rows.length,
              length: duration(excerptSeconds(rows)),
            })}
          </p>
          <p className="text-supporting text-ink-muted">{t("timeHint")}</p>
          {translated && (
            <div className="grid gap-4 split:grid-cols-2">
              <label className="space-y-1">
                <span className="block font-medium">{t("titleEn")}</span>
                <input
                  value={titleEn}
                  maxLength={100}
                  onChange={(event) => setTitleEn(event.target.value)}
                  disabled={pending}
                  className={fieldClassName}
                />
              </label>
              <label className="space-y-1">
                <span className="block font-medium">{t("titleZh")}</span>
                <input
                  value={titleZh}
                  maxLength={100}
                  onChange={(event) => setTitleZh(event.target.value)}
                  disabled={pending}
                  className={fieldClassName}
                />
              </label>
            </div>
          )}
          <ol className="divide-y divide-line border-y border-line">
            {rows.map((row, index) => (
              <RowEditor
                key={`${index}-${rows.length}`}
                row={row}
                index={index}
                last={index === rows.length - 1}
                translated={translated}
                playing={playing === index}
                disabled={pending}
                onPlay={() => play(index)}
                onChange={(change) => update(index, change)}
                onMerge={() => merge(index)}
                onRemove={() => remove(index)}
              />
            ))}
          </ol>
          <div className="flex flex-wrap gap-3">
            {translated ? (
              <Button
                variant="primary"
                onClick={save}
                disabled={
                  pending ||
                  rows.length === 0 ||
                  !(titleEn.trim() || titleZh.trim())
                }
              >
                {pending ? t("creating") : t("create")}
              </Button>
            ) : (
              <Button
                variant="primary"
                arrow
                onClick={translateRows}
                disabled={pending || rows.length === 0}
              >
                {t("translate")}
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => {
                setRows(null);
                setRecording(null);
                setFile(null);
              }}
              disabled={pending}
            >
              {t("back")}
            </Button>
          </div>
          <p className="text-supporting text-ink-muted">{t("privateNote")}</p>
        </div>
      )}

      {progress && <StageProgress stage={progress} className="max-w-sm" />}
      {error && (
        <p role="alert" className="text-supporting text-error">
          {error}
        </p>
      )}
    </div>
  );
}

/** One sentence in the preview: its times, words, and Chinese. */
function RowEditor({
  row,
  index,
  last,
  translated,
  playing,
  disabled,
  onPlay,
  onChange,
  onMerge,
  onRemove,
}: {
  row: Row;
  index: number;
  last: boolean;
  translated: boolean;
  playing: boolean;
  disabled: boolean;
  onPlay: () => void;
  onChange: (change: Partial<Row>) => void;
  onMerge: () => void;
  onRemove: () => void;
}) {
  const t = useTranslations("upload");
  const n = index + 1;
  // Typed as text; applied when it reads as a time.
  const [start, setStart] = useState(formatSeconds(row.start));
  const [end, setEnd] = useState(formatSeconds(row.end));
  const apply = (value: string, key: "start" | "end") => {
    const seconds = parseSeconds(value);
    if (seconds !== null) onChange({ [key]: seconds });
  };

  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={onPlay}
          aria-label={t(playing ? "stopN" : "playN", { n })}
        >
          {playing ? t("stop") : t("play")}
        </Button>
        <label className="flex items-center gap-2 text-supporting">
          <span className="sr-only">{t("startLabel", { n })}</span>
          <input
            value={start}
            inputMode="decimal"
            onChange={(event) => {
              setStart(event.target.value);
              apply(event.target.value, "start");
            }}
            disabled={disabled}
            className={timeClassName}
          />
        </label>
        <span aria-hidden="true">–</span>
        <label className="flex items-center gap-2 text-supporting">
          <span className="sr-only">{t("endLabel", { n })}</span>
          <input
            value={end}
            inputMode="decimal"
            onChange={(event) => {
              setEnd(event.target.value);
              apply(event.target.value, "end");
            }}
            disabled={disabled}
            className={timeClassName}
          />
        </label>
      </div>
      <textarea
        aria-label={t("enLabel", { n })}
        lang="en"
        rows={2}
        value={row.en}
        onChange={(event) => onChange({ en: event.target.value })}
        disabled={disabled}
        className={`${fieldClassName} resize-y text-sentence`}
      />
      {translated && (
        <textarea
          aria-label={t("zhLabel", { n })}
          lang="zh-Hant"
          rows={1}
          value={row.zh}
          onChange={(event) => onChange({ zh: event.target.value })}
          disabled={disabled}
          className={`${fieldClassName} resize-y text-supporting`}
        />
      )}
      <div className="flex flex-wrap gap-3">
        {!last && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onMerge}
            disabled={disabled}
            aria-label={t("mergeN", { n })}
          >
            {t("merge")}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          disabled={disabled}
          aria-label={t("removeN", { n })}
        >
          {t("remove")}
        </Button>
      </div>
    </li>
  );
}
