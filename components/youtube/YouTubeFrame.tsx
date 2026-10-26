"use client";

import { useTranslations } from "next-intl";
import type { YouTubePlayerApi } from "./useYouTubePlayer";

/**
 * The visible player. YouTube's terms require at least 200×200 px and no
 * overlays on the player, so status messages sit below it.
 */
export function YouTubeFrame({
  containerRef,
  status,
  error,
}: Pick<YouTubePlayerApi, "containerRef" | "status" | "error">) {
  const t = useTranslations("player");

  return (
    <div>
      <div
        ref={containerRef}
        // min-h-50 = 200px: keeps phones above YouTube's minimum player size.
        className="aspect-video min-h-50 w-full overflow-hidden rounded-base border border-line bg-band"
      />
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
