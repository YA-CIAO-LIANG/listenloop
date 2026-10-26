"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadYouTubeApi } from "./loadYouTubeApi";

export type PlayerStatus = "loading" | "ready" | "error";

/** Maps to a friendly message in messages/<locale>.json → player. */
export type PlayerError = "unavailable" | "embedBlocked" | "loadFailed";

export type YouTubePlayerApi = {
  /** Attach to an empty element; the player iframe is created inside it. */
  containerRef: React.RefObject<HTMLDivElement | null>;
  status: PlayerStatus;
  error: PlayerError | null;
  isPlaying: boolean;
  /** Plays start→end (seconds), then pauses automatically. */
  playSegment: (start: number, end: number) => void;
  stop: () => void;
};

// How often to check whether the segment end has been reached.
const POLL_MS = 50;

export function useYouTubePlayer(videoId: string): YouTubePlayerApi {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const pollRef = useRef<number | undefined>(undefined);
  const [status, setStatus] = useState<PlayerStatus>("loading");
  const [error, setError] = useState<PlayerError | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    let cancelled = false;

    function fail(reason: PlayerError) {
      if (cancelled) return;
      setError(reason);
      setStatus("error");
    }

    loadYouTubeApi()
      .then((api) => {
        if (cancelled || !containerRef.current) return;
        // YouTube replaces this element with its iframe, so give it a child
        // React doesn't manage.
        const mount = document.createElement("div");
        containerRef.current.replaceChildren(mount);

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
              if (!cancelled) setStatus("ready");
            },
            onError: (event) => {
              const embedBlocked =
                event.data === api.PlayerError.EmbeddingNotAllowed ||
                event.data === api.PlayerError.EmbeddingNotAllowed2;
              fail(embedBlocked ? "embedBlocked" : "unavailable");
            },
            onStateChange: (event) => {
              if (!cancelled) {
                setIsPlaying(event.data === api.PlayerState.PLAYING);
              }
            },
          },
        });
      })
      .catch(() => fail("loadFailed"));

    return () => {
      cancelled = true;
      window.clearInterval(pollRef.current);
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [videoId]);

  const stop = useCallback(() => {
    window.clearInterval(pollRef.current);
    playerRef.current?.pauseVideo();
  }, []);

  const playSegment = useCallback((start: number, end: number) => {
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
      }
    }, POLL_MS);
  }, []);

  return { containerRef, status, error, isPlaying, playSegment, stop };
}
