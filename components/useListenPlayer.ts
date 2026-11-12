"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  nextAfter,
  SENTENCE_GAP_MS,
  stepIndex,
  type LoopMode,
} from "@/lib/listen";
import { LOOP_GAP_MS } from "@/lib/player/loop";
import { setMediaPlaying, setUpMediaSession } from "@/lib/media-session";
import type { PracticeMaterial } from "@/lib/practice-material";
import { useSentencePlayer, type SentencePlayer } from "./useSentencePlayer";

export type ListenPlayer = {
  player: SentencePlayer;
  /** The sentence playing or last played. */
  current: number;
  /** Playing through (between sentences too), not just one sentence. */
  playing: boolean;
  /** The three-pass method's pass (1–3), or null. */
  pass: number | null;
  /** Plays from sentence `index` on. */
  playFrom: (index: number) => void;
  toggle: () => void;
  pause: () => void;
  step: (step: -1 | 1) => void;
  /** Starts the three passes from the first sentence. */
  startThreePasses: () => void;
};

/**
 * Listening mode's playback (D135): sentence after sentence with a short
 * pause, looping one or all, or the three-pass method; the lock screen's
 * controls for audio materials. Built on useSentencePlayer, so YouTube
 * and audio (files or a recording's times) work alike.
 */
export function useListenPlayer(
  material: PracticeMaterial,
  {
    rate,
    loop,
    title,
    start = 0,
  }: { rate: number; loop: LoopMode; title: string; start?: number },
): ListenPlayer {
  const player = useSentencePlayer(material, rate);
  const count = material.sentences.length;
  // Begins at `start` when it's a sentence of this material.
  const [current, setCurrent] = useState(() =>
    Number.isInteger(start) && start >= 0 && start < count ? start : 0,
  );
  const [playing, setPlaying] = useState(false);
  const [pass, setPass] = useState<number | null>(null);
  // Read by callbacks that outlive a render.
  const state = useRef({ current, playing, pass, loop });
  useEffect(() => {
    state.current = { ...state.current, current, pass, loop };
  }, [current, pass, loop]);
  const timer = useRef<number | undefined>(undefined);
  const { playSentence, stop } = player;

  const clearTimer = () => window.clearTimeout(timer.current);

  // Each sentence's end starts the next through this ref (a callback
  // can't name itself while it's being defined).
  const runRef = useRef<(index: number, nextPass: number | null) => void>(
    () => {},
  );
  const run = useCallback(
    (index: number, nextPass: number | null) => {
      clearTimer();
      setCurrent(index);
      setPass(nextPass);
      setPlaying(true);
      state.current = {
        ...state.current,
        current: index,
        playing: true,
        pass: nextPass,
      };
      playSentence(index, () => {
        if (!state.current.playing) return;
        const next = nextAfter(index, count, state.current.loop, nextPass);
        if (next.kind === "stop") {
          state.current.playing = false;
          setPlaying(false);
          setPass(null);
          return;
        }
        const gap =
          next.index === index && nextPass === null
            ? LOOP_GAP_MS
            : SENTENCE_GAP_MS;
        timer.current = window.setTimeout(
          () => runRef.current(next.index, next.pass ?? null),
          gap,
        );
      });
    },
    [count, playSentence],
  );
  useEffect(() => {
    runRef.current = run;
  }, [run]);

  const pause = useCallback(() => {
    clearTimer();
    state.current.playing = false;
    setPlaying(false);
    stop();
  }, [stop]);

  const playFrom = useCallback(
    (index: number) => run(index, state.current.pass),
    [run],
  );

  const toggle = useCallback(() => {
    if (state.current.playing) pause();
    else run(state.current.current, state.current.pass);
  }, [pause, run]);

  const step = useCallback(
    (direction: -1 | 1) => {
      const index = stepIndex(state.current.current, count, direction);
      if (state.current.playing) run(index, state.current.pass);
      else {
        state.current.current = index;
        setCurrent(index);
      }
    },
    [count, run],
  );

  const startThreePasses = useCallback(() => run(0, 1), [run]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // The lock screen and media keys, for audio only (YouTube's terms
  // don't allow playing its sound with the video hidden).
  const controls = useRef({ toggle, pause, step });
  useEffect(() => {
    controls.current = { toggle, pause, step };
  }, [toggle, pause, step]);
  useEffect(() => {
    if (player.kind !== "audio") return;
    const session =
      typeof navigator === "undefined" ? undefined : navigator.mediaSession;
    return setUpMediaSession(
      session,
      { title, artist: "ListenLoop", artwork: "/icons/icon-512.png" },
      {
        play: () => {
          if (!state.current.playing) controls.current.toggle();
        },
        pause: () => controls.current.pause(),
        previous: () => controls.current.step(-1),
        next: () => controls.current.step(1),
      },
    );
  }, [player.kind, title]);
  useEffect(() => {
    if (player.kind !== "audio" || typeof navigator === "undefined") return;
    setMediaPlaying(navigator.mediaSession, playing);
  }, [player.kind, playing]);

  return {
    player,
    current,
    playing,
    pass,
    playFrom,
    toggle,
    pause,
    step,
    startThreePasses,
  };
}
