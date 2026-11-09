"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PlayerStatus } from "@/components/youtube/useYouTubePlayer";

export type AudioPlayerApi = {
  status: PlayerStatus;
  /** Set when status is "error"; maps to player.audio.errors.<key>. */
  error: "loadFailed" | null;
  isPlaying: boolean;
  /** Plays sentence `index`'s file from the start, then calls `onEnd`. */
  playSentence: (index: number, onEnd?: () => void) => void;
  stop: () => void;
};

/**
 * Plays created practices' audio, one file per sentence (D23), with a
 * single <audio> element. Ready once the first file's metadata loads;
 * a file that can't load turns the player to "error". `rate` is the
 * playback speed (D73), kept at the same pitch.
 *
 * Loading (D112): the next sentence's file is fetched while this one
 * plays, and the service worker is asked to keep every sentence of this
 * practice, so a shaky connection doesn't stop it.
 */
export function useAudioPlayer(
  urls: readonly string[],
  rate = 1,
): AudioPlayerApi {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Bumped by every play or stop, so a stale "ended" never fires onEnd.
  const playToken = useRef(0);
  const [status, setStatus] = useState<PlayerStatus>(
    urls.length > 0 ? "loading" : "ready",
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const first = urls[0];

  useEffect(() => {
    if (!first) return;
    const audio = new Audio();
    audio.preload = "auto";
    audioRef.current = audio;
    const ready = () => setStatus((s) => (s === "loading" ? "ready" : s));
    const failed = () => {
      console.error(`[Audio] couldn't load ${audio.currentSrc || audio.src}`);
      setIsPlaying(false);
      setStatus("error");
    };
    const playing = () => setIsPlaying(true);
    const paused = () => setIsPlaying(false);
    audio.addEventListener("loadedmetadata", ready);
    audio.addEventListener("error", failed);
    audio.addEventListener("playing", playing);
    audio.addEventListener("pause", paused);
    audio.addEventListener("ended", paused);
    audio.src = first;
    return () => {
      // Without a source, no "ended" can fire for an earlier play.
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audio.removeEventListener("loadedmetadata", ready);
      audio.removeEventListener("error", failed);
      audio.removeEventListener("playing", playing);
      audio.removeEventListener("pause", paused);
      audio.removeEventListener("ended", paused);
      audioRef.current = null;
    };
  }, [first]);

  // Every sentence, cached ahead by the service worker (production only).
  useEffect(() => {
    if (urls.length === 0 || !("serviceWorker" in navigator)) return;
    const absolute = urls.map((url) => new URL(url, window.location.href).href);
    navigator.serviceWorker.ready
      .then((registration) =>
        registration.active?.postMessage({
          type: "cache-audio",
          urls: absolute,
        }),
      )
      .catch(() => {});
  }, [urls]);

  // The next sentence's file, loaded in the background.
  const preloader = useRef<HTMLAudioElement | null>(null);
  const preload = useCallback(
    (index: number) => {
      const next = urls[index + 1];
      if (!next) return;
      const audio = (preloader.current ??= new Audio());
      if (audio.src !== new URL(next, window.location.href).href) {
        audio.preload = "auto";
        audio.src = next;
      }
    },
    [urls],
  );

  const stop = useCallback(() => {
    playToken.current++;
    audioRef.current?.pause();
  }, []);

  const playSentence = useCallback(
    (index: number, onEnd?: () => void) => {
      const audio = audioRef.current;
      const url = urls[index];
      if (!audio || !url) return;
      const token = ++playToken.current;
      // Compare resolved URLs: audio.src is always absolute.
      if (audio.src !== new URL(url, window.location.href).href) {
        audio.src = url;
      }
      audio.currentTime = 0;
      // Set on every play: a new source resets the rate in some browsers.
      audio.preservesPitch = true;
      audio.defaultPlaybackRate = rate;
      audio.playbackRate = rate;
      audio.addEventListener(
        "ended",
        () => {
          if (playToken.current === token) onEnd?.();
        },
        { once: true },
      );
      preload(index);
      audio.play().catch((error: unknown) => {
        // A newer play() or stop() interrupts this one: not an error.
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        console.error("[Audio] play failed", error);
      });
    },
    [urls, rate, preload],
  );

  return {
    status,
    error: status === "error" ? "loadFailed" : null,
    isPlaying,
    playSentence,
    stop,
  };
}
