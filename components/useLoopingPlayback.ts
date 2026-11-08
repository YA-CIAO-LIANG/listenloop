"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { LOOP_GAP_MS, LOOP_STORAGE_KEY } from "@/lib/player/loop";

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
  } catch {
    // Storage blocked: the switch can't change; nothing else breaks.
  }
  listeners.forEach((listener) => listener());
}

/**
 * Plays a sentence and, with `loop` on, plays it again LOOP_GAP_MS after
 * each ending while `active` (dictation: until the answer is submitted).
 * Moving to another sentence, turning loop off, or leaving the page stops
 * the next round.
 */
export function useLoopingPlayback(
  playAt: (index: number, onEnd?: () => void) => void,
  index: number,
  active: boolean,
) {
  const loop = useSyncExternalStore(subscribe, readLoop, () => false);
  const timer = useRef<number | undefined>(undefined);
  const state = useRef({ loop, active, index });
  useEffect(() => {
    state.current = { loop, active, index };
  }, [loop, active, index]);

  const startRef = useRef<(target: number) => void>(() => {});
  const start = useCallback(
    (target: number) => {
      window.clearTimeout(timer.current);
      playAt(target, () => {
        const { loop, active, index } = state.current;
        if (loop && active && index === target) {
          timer.current = window.setTimeout(
            () => startRef.current(target),
            LOOP_GAP_MS,
          );
        }
      });
    },
    [playAt],
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
