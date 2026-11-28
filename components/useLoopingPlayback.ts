"use client";

import { settingsChanged } from "@/lib/personal-settings";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { LOOP_STORAGE_KEY } from "@/lib/player/loop";
import { usePlayback } from "./usePlayback";

// The Loop switch, remembered in this browser; the server renders it off.
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function readLoop(): boolean {
  try {
    return localStorage.getItem(LOOP_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}
function writeLoop(on: boolean) {
  try {
    localStorage.setItem(LOOP_STORAGE_KEY, on ? "1" : "0");
    settingsChanged();
  } catch {
    // Storage blocked: the switch can't change; nothing else breaks.
  }
  listeners.forEach((listener) => listener());
}

/**
 * Plays a sentence (as many times as the kept playback settings say,
 * D220) and, with `loop` on, plays it again after each ending while
 * `active` (dictation: until the answer is submitted); the pause between
 * plays is the kept one too.
 * Moving to another sentence, turning loop off, or leaving the page stops
 * the next round.
 */
export function useLoopingPlayback(
  playAt: (index: number, onEnd?: () => void) => void,
  index: number,
  active: boolean,
) {
  const loop = useSyncExternalStore(subscribe, readLoop, () => false);
  const [playback] = usePlayback();
  const gapMs = playback.gap * 1000;
  const repeats = playback.repeats;
  const timer = useRef<number | undefined>(undefined);
  const state = useRef({ loop, active, index });
  useEffect(() => {
    state.current = { loop, active, index };
  }, [loop, active, index]);

  const startRef = useRef<(target: number, again?: boolean) => void>(() => {});
  const left = useRef(0);
  const start = useCallback(
    (target: number, again = false) => {
      window.clearTimeout(timer.current);
      if (!again) left.current = repeats - 1;
      playAt(target, () => {
        const { loop, active, index } = state.current;
        if (index !== target) return;
        if (left.current > 0) {
          left.current -= 1;
          timer.current = window.setTimeout(
            () => startRef.current(target, true),
            gapMs,
          );
        } else if (loop && active) {
          timer.current = window.setTimeout(
            () => startRef.current(target, true),
            gapMs,
          );
        }
      });
    },
    [playAt, gapMs, repeats],
  );
  useEffect(() => {
    startRef.current = start;
  }, [start]);

  // A new sentence, a submitted answer, or loop off: no more rounds.
  useEffect(() => {
    if (!active || !loop) window.clearTimeout(timer.current);
  }, [active, loop, index]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const setLoop = useCallback((on: boolean) => writeLoop(on), []);

  return { loop, setLoop, start };
}
