"use client";

import { settingsChanged } from "@/lib/personal-settings";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { missedPieces, markSentence } from "@/lib/custom-practice/marks";
import { isHandoutUnlocked } from "@/lib/cycle";
import {
  LISTEN_STORAGE_KEY,
  LOOP_MODES,
  parseListenSettings,
  shownSubtitles,
  SUBTITLE_MODES,
  THREE_PASSES,
  type ListenSettings,
} from "@/lib/listen";
import type { PracticeMaterial } from "@/lib/practice-material";
import { DEFAULT_SPEED, type Speed } from "@/lib/speed";
import { oneLineTitle } from "@/lib/titles";
import { Button } from "./Button";
import { ButtonLink } from "./ButtonLink";
import { PracticeFrame } from "./PracticeFrame";
import { SegmentedControl } from "./SegmentedControl";
import { Marked } from "./SentenceExplanation";
import { SpeedControl } from "./SpeedControl";
import { useStores } from "./StoresProvider";
import { useListenPlayer } from "./useListenPlayer";
import { usePracticeTimer } from "./usePracticeTimer";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

function readSettings(): ListenSettings {
  try {
    return parseListenSettings(localStorage.getItem(LISTEN_STORAGE_KEY));
  } catch {
    return parseListenSettings(null);
  }
}

function saveSettings(settings: ListenSettings) {
  try {
    localStorage.setItem(LISTEN_STORAGE_KEY, JSON.stringify(settings));
    settingsChanged();
  } catch {
    // Storage blocked: the choice lasts for this visit only.
  }
}

/**
 * Listening mode (D135), open once Day 1 is done (like the handout):
 * listen to the whole text without a test, with or without subtitles.
 */
export function ListenSession({
  video,
  start = 0,
}: {
  video: PracticeMaterial;
  /** The sentence to begin at (?s=, from the misheard-word review, D145). */
  start?: number;
}) {
  const t = useTranslations("listen");
  const { progress: progressStore } = useStores();
  const [state, setState] = useState<"loading" | "locked" | "open">("loading");
  const [answers, setAnswers] = useState<readonly (string | null)[]>([]);

  useEffect(() => {
    let cancelled = false;
    progressStore
      .get(video.id)
      .then((progress) => {
        if (cancelled) return;
        setAnswers(progress?.days[1]?.answers ?? []);
        setState(isHandoutUnlocked(progress) ? "open" : "locked");
      })
      .catch(() => {
        if (!cancelled) setState("locked");
      });
    return () => {
      cancelled = true;
    };
  }, [progressStore, video.id]);

  if (state === "loading") {
    return (
      <p role="status" className="text-ink-muted">
        {t("loading")}
      </p>
    );
  }
  if (state === "locked") {
    return (
      <div className="space-y-4">
        <p className="max-w-reading">{t("locked")}</p>
        <ButtonLink href={`/videos/${video.id}/day/1`} variant="primary" arrow>
          {t("goDay1")}
        </ButtonLink>
      </div>
    );
  }
  return <Listening video={video} answers={answers} start={start} />;
}

function Listening({
  video,
  answers,
  start,
}: {
  video: PracticeMaterial;
  answers: readonly (string | null)[];
  start: number;
}) {
  const t = useTranslations("listen");
  const reduceMotion = usePrefersReducedMotion();
  const [settings, setSettings] = useState<ListenSettings>(readSettings);
  const [speed, setSpeed] = useState<Speed>(DEFAULT_SPEED);
  const title = oneLineTitle({ en: video.title, zh: video.titleZh ?? null });
  const listen = useListenPlayer(video, {
    rate: speed,
    loop: settings.loop,
    title,
    start,
  });
  const { player, current, playing, pass } = listen;
  usePracticeTimer(video.id, player.isPlaying, { background: true });
  const shown = shownSubtitles(settings.subtitles, pass);

  const change = (next: Partial<ListenSettings>) => {
    const merged = { ...settings, ...next };
    setSettings(merged);
    saveSettings(merged);
  };

  // The sentence playing stays in the middle of the screen.
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    if (!playing) return;
    items.current[current]?.scrollIntoView({
      block: "center",
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [current, playing, reduceMotion]);

  // Space plays or pauses; arrows go to the previous or next sentence.
  const keys = useRef(listen);
  useEffect(() => {
    keys.current = listen;
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(
          "input, textarea, select, button, a, [role=radio], [contenteditable=true]",
        )
      ) {
        return;
      }
      if (event.key === " ") {
        event.preventDefault();
        keys.current.toggle();
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        keys.current.step(-1);
      } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        keys.current.step(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const ready = player.status === "ready";

  return (
    <div className="space-y-6">
      <PracticeFrame player={player} />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => listen.step(-1)}
            disabled={!ready}
            aria-label={t("previous")}
          >
            <span aria-hidden="true">←</span>
          </Button>
          <Button variant="primary" onClick={listen.toggle} disabled={!ready}>
            {playing ? t("pause") : t("play")}
          </Button>
          <Button
            variant="secondary"
            onClick={() => listen.step(1)}
            disabled={!ready}
            aria-label={t("next")}
          >
            <span aria-hidden="true">→</span>
          </Button>
          <Button
            variant="secondary"
            onClick={listen.startThreePasses}
            disabled={!ready}
          >
            {t("threePasses")}
          </Button>
        </div>
        <p role="status" className="text-supporting text-ink-muted">
          {pass !== null
            ? t("passStatus", {
                pass,
                total: THREE_PASSES.length,
                mode: t(`subtitles.${shown}`),
              })
            : t("position", {
                n: current + 1,
                total: video.sentences.length,
              })}
        </p>
        <p className="text-supporting text-ink-muted">{t("keysHint")}</p>
        <div className="flex flex-wrap gap-x-8 gap-y-4">
          <SegmentedControl
            legend={t("subtitlesLegend")}
            value={settings.subtitles}
            options={SUBTITLE_MODES.map((mode) => ({
              value: mode,
              label: t(`subtitles.${mode}`),
            }))}
            onChange={(subtitles) => change({ subtitles })}
            optionWidthClassName="min-w-16"
          />
          <SegmentedControl
            legend={t("loopLegend")}
            value={settings.loop}
            options={LOOP_MODES.map((mode) => ({
              value: mode,
              label: t(`loops.${mode}`),
            }))}
            onChange={(loop) => change({ loop })}
            optionWidthClassName="min-w-16"
          />
        </div>
        {player.kind === "audio" && (
          <SpeedControl value={speed} onChange={setSpeed} showWeights={false} />
        )}
        {player.kind === "audio" && (
          <p className="text-supporting text-ink-muted">{t("background")}</p>
        )}
      </div>

      {/* Under the player, never over it (YouTube's terms). */}
      <ol aria-label={t("sentencesLabel")} className="space-y-2">
        {video.sentences.map((sentence, i) => {
          const answer = answers[i];
          const missed =
            typeof answer === "string"
              ? missedPieces(sentence.en, answer)
              : new Set<number>();
          const active = i === current;
          return (
            <li key={i}>
              <button
                type="button"
                ref={(element) => {
                  items.current[i] = element;
                }}
                aria-current={active ? "true" : undefined}
                aria-label={
                  shown === "blind"
                    ? t("playSentence", { n: i + 1 })
                    : undefined
                }
                onClick={() => listen.playFrom(i)}
                disabled={!ready}
                className={`block w-full rounded-base border px-4 py-3 text-left transition-colors motion-reduce:transition-none pointer-coarse:min-h-11 ${
                  active
                    ? "border-accent bg-band"
                    : "border-line bg-surface hover:border-ink-muted"
                }`}
              >
                {shown === "blind" ? (
                  <span className="text-supporting text-ink-muted">
                    {t("sentenceN", { n: i + 1 })}
                  </span>
                ) : (
                  <>
                    {(shown === "en" || shown === "both") && (
                      <span lang="en" className="block text-sentence">
                        <Marked segments={markSentence(sentence.en, missed)} />
                      </span>
                    )}
                    {(shown === "zh" || shown === "both") && (
                      <span
                        lang="zh-Hant"
                        className={`block ${shown === "both" ? "mt-1 text-supporting text-ink-muted" : "text-sentence"}`}
                      >
                        {sentence.zh}
                      </span>
                    )}
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ol>
      {answers.some((a) => typeof a === "string") && (
        <p className="text-supporting text-ink-muted">{t("marksNote")}</p>
      )}
    </div>
  );
}
