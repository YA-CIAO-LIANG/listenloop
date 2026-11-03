"use client";

import { useTranslations } from "next-intl";
import { SpeakerIcon } from "@/components/icons";
import type { AudioPlayerApi } from "./useAudioPlayer";

/**
 * Where the video sits on practice pages, for practices that are audio
 * only: a quiet panel saying so (and when it's playing), with load status
 * below, like YouTubeFrame.
 */
export function AudioFrame({
  status,
  error,
  isPlaying,
}: Pick<AudioPlayerApi, "status" | "error" | "isPlaying">) {
  const t = useTranslations("player.audio");

  return (
    <div>
      <div className="flex min-h-24 items-center gap-4 rounded-base border border-line bg-band px-6 py-4">
        <SpeakerIcon
          className={`size-6 shrink-0 ${isPlaying ? "text-accent-ink" : "text-ink-muted"}`}
        />
        <div>
          <p className="font-medium">{t("title")}</p>
          <p className="text-supporting text-ink-muted">
            {isPlaying ? t("playing") : t("hint")}
          </p>
        </div>
      </div>
      {status === "loading" && (
        <p role="status" className="mt-2 text-supporting text-ink-muted">
          {t("loading")}
        </p>
      )}
      {status === "error" && error && (
        <p role="alert" className="mt-2 text-supporting text-error">
          {t(`errors.${error}`)}
        </p>
      )}
    </div>
  );
}
