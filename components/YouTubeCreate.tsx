"use client";

import Link from "next/link";
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
  createYouTubePractice,
  lookupYouTube,
  type CreateYouTubePracticeResult,
  type LookupYouTubeResult,
} from "@/app/materials/youtube-actions";
import { parseYouTubeTranscript } from "@/lib/draft-video";
import { TRANSLATE_BATCH } from "@/lib/custom-practice/notes";
import { can, PLANS } from "@/lib/plans";
import { customPracticeId } from "@/lib/practice-material";
import {
  excerptSeconds,
  transcriptSentences,
  type TimedSentence,
  type YouTubeVideoInfo,
} from "@/lib/youtube";
import { Button } from "./Button";
import { ButtonLink } from "./ButtonLink";
import { usePlan } from "./PlanProvider";
import { prepareForPractice, type Stage } from "./practice-generation";
import { StageProgress } from "./StageProgress";
import { Tag } from "./Tag";

const fieldClassName =
  "block w-full rounded-base border border-line bg-surface px-4 py-3 focus-visible:border-accent";

type Row = TimedSentence & { zh: string };

/** "1:05" or "65" → 65 seconds; "" → undefined; anything else NaN. */
function parseTime(value: string): number | undefined {
  const text = value.trim();
  if (!text) return undefined;
  const match = /^(?:(\d+):)?(\d+)$/.exec(text);
  if (!match) return Number.NaN;
  return Number(match[1] ?? 0) * 60 + Number(match[2]);
}

const clock = (seconds: number) => {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

/**
 * A practice from a YouTube video (D97): the learner pastes the link (its
 * title, channel, license, and length are read from YouTube), then the
 * video's transcript copied from YouTube; the transcript becomes timed
 * sentences, which are translated, reviewed, and saved. Practicing plays
 * the video itself. Paid plans only; others see what it is and the plans.
 */
export function YouTubeCreate({
  lookup = lookupYouTube,
  create = createYouTubePractice,
  translate = translateSentences,
  generateNotes = generatePracticeNotes,
  generate = generatePracticeAudio,
  record = recordIntent,
}: {
  /** Injected in tests; the Server Actions otherwise. */
  lookup?: (url: string) => Promise<LookupYouTubeResult>;
  create?: (input: unknown) => Promise<CreateYouTubePracticeResult>;
  translate?: (s: string[], l: "en") => Promise<TranslateResult>;
  generateNotes?: typeof generatePracticeNotes;
  generate?: typeof generatePracticeAudio;
  record?: typeof recordIntent;
}) {
  const t = useTranslations("youtube");
  const router = useRouter();
  const plan = usePlan();
  const ids = { url: useId(), transcript: useId(), hint: useId() };
  const [url, setUrl] = useState("");
  const [video, setVideo] = useState<YouTubeVideoInfo | null>(null);
  const [transcript, setTranscript] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [titleEn, setTitleEn] = useState("");
  const [titleZh, setTitleZh] = useState("");
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState<Stage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const maxSeconds = PLANS[plan].maxPracticeSeconds;
  const allowed = can(plan, { kind: "youtube-practice" }).ok;
  // A free plan opening this is interest in paying (D129), recorded once
  // like the other paid-feature doors.
  const recorded = useRef(false);
  useEffect(() => {
    if (allowed || recorded.current) return;
    recorded.current = true;
    void record({
      step: "unlock_click",
      item: "youtube-practice",
      source: "youtube",
    }).catch(() => {});
  }, [allowed, record]);

  if (!allowed) {
    return (
      <div className="space-y-3 rounded-base border border-line surface-card p-4">
        <p>{t("paidOnly")}</p>
        <ButtonLink href="/pricing?from=youtube" variant="secondary" arrow>
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

  async function read() {
    setPending(true);
    setError(null);
    const result = await lookup(url).catch((): LookupYouTubeResult => ({
      ok: false,
      reason: "failed",
    }));
    setPending(false);
    if (!result.ok) {
      setError(t(`errors.${result.reason}`));
      return;
    }
    setVideo(result.video);
    setTitleEn(result.video.title.slice(0, 100));
  }

  async function prepare() {
    setError(null);
    let cues;
    try {
      cues = parseYouTubeTranscript(transcript);
    } catch {
      setError(t("errors.transcript"));
      return;
    }
    const range = { from: parseTime(from), to: parseTime(to) };
    if (Number.isNaN(range.from) || Number.isNaN(range.to)) {
      setError(t("errors.range"));
      return;
    }
    const sentences = transcriptSentences(cues, range);
    if (sentences.length === 0) {
      setError(t("errors.transcript"));
      return;
    }
    if (maxSeconds !== null && excerptSeconds(sentences) > maxSeconds) {
      setError(
        t("errors.tooLong", {
          length: duration(excerptSeconds(sentences)),
          max: duration(maxSeconds),
        }),
      );
      return;
    }
    setPending(true);
    const translations: string[] = [];
    for (let start = 0; start < sentences.length; start += TRANSLATE_BATCH) {
      setProgress({
        stage: "translate",
        done: translations.length,
        total: sentences.length,
      });
      const batch = sentences.slice(start, start + TRANSLATE_BATCH);
      const result = await translate(
        batch.map((s) => s.en),
        "en",
      ).catch((): TranslateResult => ({ ok: false, reason: "failed" }));
      if (!result.ok) {
        setPending(false);
        setProgress(null);
        setError(
          t(result.reason === "limit" ? "errors.limit" : "errors.failed"),
        );
        return;
      }
      translations.push(...result.translations);
    }
    setPending(false);
    setProgress(null);
    setRows(sentences.map((s, i) => ({ ...s, zh: translations[i] ?? "" })));
  }

  async function save() {
    if (!rows || !video) return;
    setPending(true);
    setError(null);
    const result = await create({
      url: video.id,
      titleEn,
      titleZh,
      sentences: rows,
    }).catch((): CreateYouTubePracticeResult => ({
      ok: false,
      reason: "failed",
    }));
    if (!result.ok) {
      setPending(false);
      setError(
        result.reason === "too-long" && result.max
          ? t("errors.tooLong", {
              length: duration(excerptSeconds(rows)),
              max: duration(result.max),
            })
          : t(
              `errors.${result.reason === "too-long" ? "failed" : result.reason}`,
            ),
      );
      return;
    }
    // Notes, as for any practice; there's no audio to make.
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

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label htmlFor={ids.url} className="block font-medium">
          {t("urlLabel")}
        </label>
        <div className="flex flex-wrap gap-3">
          <input
            id={ids.url}
            type="url"
            inputMode="url"
            value={url}
            placeholder="https://www.youtube.com/watch?v=…"
            onChange={(event) => {
              setUrl(event.target.value);
              setVideo(null);
              setRows(null);
            }}
            disabled={pending}
            className={`${fieldClassName} max-w-md min-w-0 flex-1 basis-48`}
          />
          <Button
            variant="secondary"
            onClick={read}
            disabled={pending || !url.trim()}
          >
            {t("read")}
          </Button>
        </div>
      </div>

      {video && (
        <div className="space-y-2 rounded-base border border-line surface-card p-4">
          <p className="font-medium" lang="en">
            {video.title}
          </p>
          <p className="text-supporting text-ink-muted">
            {t("videoMeta", {
              channel: video.channel,
              length: duration(video.durationSeconds),
            })}
          </p>
          <p className="flex flex-wrap items-center gap-2 text-supporting">
            <Tag>
              {video.license === "creativeCommon" ? "CC BY" : t("standard")}
            </Tag>
            {video.license === "creativeCommon"
              ? t("ccNote")
              : t("standardNote")}
          </p>
        </div>
      )}

      {video && !rows && (
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor={ids.transcript} className="block font-medium">
              {t("transcriptLabel")}
            </label>
            <p id={ids.hint} className="text-supporting text-ink-muted">
              {t("transcriptHint")}
            </p>
            <textarea
              id={ids.transcript}
              aria-describedby={ids.hint}
              rows={8}
              lang="en"
              value={transcript}
              onChange={(event) => setTranscript(event.target.value)}
              disabled={pending}
              className={`${fieldClassName} resize-y`}
            />
          </div>
          <fieldset className="space-y-2">
            <legend className="font-medium">{t("rangeLegend")}</legend>
            <p className="text-supporting text-ink-muted">
              {maxSeconds === null
                ? t("rangeHint")
                : t("rangeHintMax", { max: duration(maxSeconds) })}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2">
                {t("from")}
                <input
                  value={from}
                  placeholder="0:00"
                  onChange={(event) => setFrom(event.target.value)}
                  disabled={pending}
                  className="h-10 w-24 rounded-base border border-line bg-surface px-3 tabular-nums pointer-coarse:min-h-11"
                />
              </label>
              <label className="flex items-center gap-2">
                {t("to")}
                <input
                  value={to}
                  placeholder={clock(video.durationSeconds)}
                  onChange={(event) => setTo(event.target.value)}
                  disabled={pending}
                  className="h-10 w-24 rounded-base border border-line bg-surface px-3 tabular-nums pointer-coarse:min-h-11"
                />
              </label>
            </div>
          </fieldset>
          <Button
            variant="primary"
            arrow
            onClick={prepare}
            disabled={pending || !transcript.trim()}
          >
            {t("prepare")}
          </Button>
        </div>
      )}

      {rows && (
        <div className="space-y-4">
          <p className="text-supporting text-ink-muted">
            {t("reviewIntro", {
              count: rows.length,
              length: duration(excerptSeconds(rows)),
            })}
          </p>
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
          <ol className="divide-y divide-line border-y border-line">
            {rows.map((row, index) => (
              <li key={index} className="space-y-2 py-3">
                <p className="text-metadata text-ink-muted tabular-nums">
                  {clock(row.start)}–{clock(row.end)}
                </p>
                <p lang="en" className="text-sentence">
                  {row.en}
                </p>
                <textarea
                  aria-label={t("zhLabel", { n: index + 1 })}
                  lang="zh-Hant"
                  rows={1}
                  value={row.zh}
                  onChange={(event) =>
                    setRows(
                      (current) =>
                        current?.map((r, i) =>
                          i === index ? { ...r, zh: event.target.value } : r,
                        ) ?? null,
                    )
                  }
                  disabled={pending}
                  className={`${fieldClassName} resize-y text-supporting`}
                />
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="primary"
              onClick={save}
              disabled={pending || !(titleEn.trim() || titleZh.trim())}
            >
              {pending ? t("creating") : t("create")}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setRows(null)}
              disabled={pending}
            >
              {t("back")}
            </Button>
          </div>
          <p className="text-supporting text-ink-muted">
            {t("attribution")}{" "}
            <Link
              href="/credits"
              className="text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink"
            >
              {t("credits")}
            </Link>
          </p>
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
