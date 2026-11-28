"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { wordAudioUrl } from "@/app/videos/[id]/quiz/actions";

/** The browser's own voice, when no recorded word is available. */
function speakWithBrowser(
  word: string,
  lang: string,
  onEnd: () => void,
  rate = 1,
) {
  try {
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.onend = onEnd;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  } catch {
    // No speech synthesis: the sentence's audio is still there.
  }
}

/**
 * One word's sound for the misheard-word review (D145): the shared
 * recording (made once for everyone, D136), else the browser's voice.
 * Plays once when the word arrives; `play` replays it; with `loop` on it
 * plays again `gapMs` after each end until turned off or the word changes.
 * With `repeats` (D220) it plays that many times on arriving, `gapMs`
 * apart; `rate` is the playback speed (pitch kept); `voice` is passed to
 * `audioUrl` (writing sentences, D220).
 */
export function useWordSound(
  videoId: string | null,
  word: string | null,
  {
    loop,
    gapMs,
    lang = "en-US",
    audioUrl = wordAudioUrl,
    autoplay = true,
    repeats = 1,
    rate = 1,
    voice,
  }: {
    loop: boolean;
    gapMs: number;
    lang?: string;
    audioUrl?: (
      id: string,
      text: string,
      voice?: string,
    ) => Promise<{ ok: true; url: string } | { ok: false }>;
    /** Play once on arriving at each word (default); off: only on `play`. */
    autoplay?: boolean;
    /** Plays on arriving (D220). */
    repeats?: number;
    /** Playback speed (D220). */
    rate?: number;
    voice?: string;
  },
) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [sound, setSound] = useState<{ word: string; url: string | null }>();
  const loopRef = useRef(loop);
  const timer = useRef<number | undefined>(undefined);
  const playRef = useRef<() => void>(() => {});
  // Plays still to come of the arrival's repeats (D220).
  const left = useRef(0);
  const ready = sound !== undefined && sound.word === word;

  const ended = useCallback(() => {
    window.clearTimeout(timer.current);
    if (left.current > 0) {
      left.current -= 1;
      timer.current = window.setTimeout(() => playRef.current(), gapMs);
    } else if (loopRef.current) {
      timer.current = window.setTimeout(() => playRef.current(), gapMs);
    }
  }, [gapMs]);

  const play = useCallback(() => {
    if (!word || !ready) return;
    window.clearTimeout(timer.current);
    if (sound.url) {
      const element = (audio.current ??= new Audio());
      if (element.src !== sound.url) element.src = sound.url;
      element.onended = ended;
      element.playbackRate = rate;
      element.currentTime = 0;
      void element.play().catch(() => {});
    } else {
      speakWithBrowser(word, lang, ended, rate);
    }
  }, [word, ready, sound, lang, ended, rate]);

  useEffect(() => {
    playRef.current = play;
  }, [play]);

  // Turning loop on plays it now; off stops the next one.
  useEffect(() => {
    loopRef.current = loop;
    if (loop) playRef.current();
    else window.clearTimeout(timer.current);
  }, [loop]);

  // The recording's address, once per word.
  useEffect(() => {
    if (!videoId || !word) return;
    let cancelled = false;
    void audioUrl(videoId, word, voice)
      .catch(() => ({ ok: false as const }))
      .then((result) => {
        if (!cancelled) setSound({ word, url: result.ok ? result.url : null });
      });
    return () => {
      cancelled = true;
    };
  }, [audioUrl, videoId, word, voice]);

  // Played once on arriving at each word.
  const played = useRef<string | null>(null);
  useEffect(() => {
    if (!ready || !word || played.current === word) return;
    played.current = word;
    if (autoplay) {
      left.current = Math.max(0, Math.round(repeats) - 1);
      play();
    }
  }, [ready, word, play, autoplay, repeats]);

  // Nothing keeps playing after the word changes or the page goes.
  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      left.current = 0;
      audio.current?.pause();
      try {
        window.speechSynthesis?.cancel();
      } catch {
        // Nothing to stop.
      }
    },
    [word],
  );

  return { play, ready };
}
