"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadYouTubeApi } from "./loadYouTubeApi";

export type PlayerStatus = "loading" | "ready" | "error";

/** Maps to a friendly message in messages/<locale>.json → player. */
export type PlayerError =
  | "unavailable"
  | "embedBlocked"
  | "loadFailed"
  /** The API loaded but the player never became ready (e.g. Brave Shields). */
  | "blocked";

export type YouTubePlayerApi = {
  /**
   * Attach to an empty element; the player iframe is created inside it. A
   * callback ref, so the player is created whenever the element appears,
   * even if that's after the first render (e.g. once saved progress loads).
   */
  containerRef: (element: HTMLDivElement | null) => void;
  status: PlayerStatus;
  error: PlayerError | null;
  isPlaying: boolean;
  /**
   * Plays start→end (seconds), then pauses automatically and calls `onEnd`.
   * `onEnd` doesn't fire if playback is stopped or another segment starts.
   */
  playSegment: (start: number, end: number, onEnd?: () => void) => void;
  /** Plays from `start` until stopped (the timing tool's tap mode). */
  playFrom: (start: number) => void;
  /** Where playback is now, in seconds (0 before the player is ready). */
  currentTime: () => number;
  stop: () => void;
};

// How often to check whether the segment end has been reached.
const POLL_MS = 50;

/** No onReady within this time means the player iframe was blocked. */
export const READY_TIMEOUT_MS = 15_000;

/** YouTube onError codes, for readable console messages. */
const ERROR_NAMES: Record<number, string> = {
  2: "invalid parameter",
  5: "HTML5 player error",
  100: "video not found or private",
  101: "embedding not allowed",
  150: "embedding not allowed",
};

export function useYouTubePlayer(videoId: string): YouTubePlayerApi {
  // State, not a ref: attaching the element must re-run the effect below.
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const pollRef = useRef<number | undefined>(undefined);
  const [status, setStatus] = useState<PlayerStatus>("loading");
  const [error, setError] = useState<PlayerError | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    // No element yet (or it was removed): nothing to create.
    if (!container) return;
    let cancelled = false;
    let readyTimer: number | undefined;

    // Errors are also logged with a [YouTube] prefix so users can report them.
    function fail(reason: PlayerError, detail: string) {
      if (cancelled) return;
      window.clearTimeout(readyTimer);
      console.error(`[YouTube] ${detail} (video ${videoId})`);
      setError(reason);
      setStatus("error");
    }

    loadYouTubeApi()
      .then((api) => {
        if (cancelled) return;
        readyTimer = window.setTimeout(
          () =>
            fail(
              "blocked",
              `player not ready after ${READY_TIMEOUT_MS / 1000} s; likely blocked by the browser or an extension`,
            ),
          READY_TIMEOUT_MS,
        );
        // YouTube replaces this element with its iframe, so give it a child
        // React doesn't manage.
        const mount = document.createElement("div");
        container.replaceChildren(mount);

        playerRef.current = new api.Player(mount, {
          // youtube-nocookie.com: no tracking cookies until the user plays.
          host: "https://www.youtube-nocookie.com",
          videoId,
          width: "100%",
          height: "100%",
          playerVars: {
            playsinline: 1,
            rel: 0,
            // Never force captions on. YouTube offers no documented way to
            // force them off: they follow the viewer's own preference, so
            // practice pages ask the user to turn CC off themselves.
            cc_load_policy: 0,
            iv_load_policy: 3,
          },
          events: {
            onReady: () => {
              window.clearTimeout(readyTimer);
              if (!cancelled) setStatus("ready");
            },
            onError: (event) => {
              const embedBlocked =
                event.data === api.PlayerError.EmbeddingNotAllowed ||
                event.data === api.PlayerError.EmbeddingNotAllowed2;
              fail(
                embedBlocked ? "embedBlocked" : "unavailable",
                `player error ${event.data} (${ERROR_NAMES[event.data] ?? "unknown"})`,
              );
            },
            onStateChange: (event) => {
              if (!cancelled) {
                setIsPlaying(event.data === api.PlayerState.PLAYING);
              }
            },
          },
        });
      })
      .catch((error: unknown) =>
        fail(
          "loadFailed",
          `IFrame API failed to load: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );

    return () => {
      cancelled = true;
      window.clearTimeout(readyTimer);
      window.clearInterval(pollRef.current);
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [videoId, container]);

  const stop = useCallback(() => {
    window.clearInterval(pollRef.current);
    playerRef.current?.pauseVideo();
  }, []);

  const playSegment = useCallback(
    (start: number, end: number, onEnd?: () => void) => {
      const player = playerRef.current;
      if (!player) return;
      window.clearInterval(pollRef.current);

      player.seekTo(start, true);
      player.playVideo();

      let reachedStart = false;
      pollRef.current = window.setInterval(() => {
        const time = player.getCurrentTime();
        // Right after seeking, YouTube can still report the old position;
        // only stop once playback is actually inside this segment.
        if (time >= start - 0.25 && time < end) reachedStart = true;
        if (reachedStart && time >= end) {
          player.pauseVideo();
          window.clearInterval(pollRef.current);
          onEnd?.();
        }
      }, POLL_MS);
    },
    [],
  );

  const playFrom = useCallback((start: number) => {
    const player = playerRef.current;
    if (!player) return;
    window.clearInterval(pollRef.current);
    player.seekTo(start, true);
    player.playVideo();
  }, []);

  const currentTime = useCallback(
    () => playerRef.current?.getCurrentTime() ?? 0,
    [],
  );

  return {
    containerRef: setContainer,
    status,
    error,
    isPlaying,
    playSegment,
    playFrom,
    currentTime,
    stop,
  };
}
