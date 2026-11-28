"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { GAPS, PLAYBACK_VOICES, REPEATS, type Playback } from "@/lib/playback";
import { SPEEDS } from "@/lib/speed";
import { usePlayback } from "./usePlayback";

/**
 * The playback settings (D220), the same everywhere and kept once set:
 * plays per sentence, the pause between plays, speed, playing by itself,
 * and (writing) the voice. `compact`: folded under "Playback" beside a
 * practice's play button; otherwise a settings form. `only` limits the
 * rows to what the page uses (a YouTube video has no speed, D73).
 */
export function PlaybackControls({
  compact = false,
  only,
}: {
  compact?: boolean;
  only?: readonly (keyof Playback)[];
}) {
  const t = useTranslations("playback");
  const [playback, change] = usePlayback();
  const id = useId();
  const shows = (name: keyof Playback) => !only || only.includes(name);
  const select =
    "min-h-8 rounded-base border border-line bg-surface px-2 text-supporting pointer-coarse:min-h-11";
  const row = "flex flex-wrap items-center justify-between gap-x-4 gap-y-1";
  const rows = (
    <div className="flex flex-col gap-3" data-testid="playback-settings">
      {shows("repeats") && (
        <label className={row}>
          <span>{t("repeats")}</span>
          <select
            className={select}
            value={playback.repeats}
            onChange={(e) =>
              change({ repeats: Number(e.target.value) as Playback["repeats"] })
            }
          >
            {REPEATS.map((n) => (
              <option key={n} value={n}>
                {t("times", { n })}
              </option>
            ))}
          </select>
        </label>
      )}
      {shows("gap") && (
        <label className={row}>
          <span>{t("gap")}</span>
          <select
            className={select}
            value={playback.gap}
            onChange={(e) =>
              change({ gap: Number(e.target.value) as Playback["gap"] })
            }
          >
            {GAPS.map((n) => (
              <option key={n} value={n}>
                {t("seconds", { n })}
              </option>
            ))}
          </select>
        </label>
      )}
      {shows("speed") && (
        <label className={row}>
          <span>{t("speed")}</span>
          <select
            className={select}
            value={playback.speed}
            onChange={(e) =>
              change({ speed: Number(e.target.value) as Playback["speed"] })
            }
          >
            {SPEEDS.map((n) => (
              <option key={n} value={n}>
                {t("rate", { n })}
              </option>
            ))}
          </select>
        </label>
      )}
      {shows("voice") && (
        <label className={row}>
          <span>{t("voice")}</span>
          <select
            className={select}
            value={playback.voice}
            onChange={(e) =>
              change({ voice: e.target.value as Playback["voice"] })
            }
          >
            {PLAYBACK_VOICES.map((v) => (
              <option key={v} value={v}>
                {t(`voices.${v}`)}
              </option>
            ))}
          </select>
        </label>
      )}
      {shows("autoplay") && (
        <label className="tap flex min-h-8 items-center gap-3 pointer-coarse:min-h-11">
          <input
            type="checkbox"
            checked={playback.autoplay}
            onChange={(e) => change({ autoplay: e.target.checked })}
            className="size-4 shrink-0 accent-accent"
          />
          {t("autoplay")}
        </label>
      )}
      <p className="text-metadata text-ink-muted">{t("kept")}</p>
    </div>
  );
  if (!compact) return rows;
  return (
    <details className="group relative">
      <summary
        aria-describedby={`${id}-now`}
        className="tap inline-flex min-h-8 cursor-pointer items-center rounded-base px-3 text-supporting text-ink-muted hover:bg-ink/5 hover:text-ink pointer-coarse:min-h-11"
      >
        {t("title")}
        <span aria-hidden="true" className="ml-1 group-open:rotate-180">
          ▾
        </span>
      </summary>
      <span id={`${id}-now`} className="sr-only">
        {t("now", {
          repeats: playback.repeats,
          speed: playback.speed,
          gap: playback.gap,
        })}
      </span>
      <div className="mt-2 w-72 max-w-[calc(100vw-3rem)] rounded-base border border-line surface-card p-3">
        {rows}
      </div>
    </details>
  );
}
