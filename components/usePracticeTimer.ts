"use client";

import { useEffect, useRef } from "react";
import { updateActivity } from "@/lib/claim-rewards";
import { toLocalDate } from "@/lib/dates";
import {
  addPracticeTime,
  isPracticing,
  TIMER_START,
  timerFlush,
  timerTick,
  type TimerFlush,
} from "@/lib/practice-time";
import { useStores } from "./StoresProvider";

const DEVICE_KEY = "ll-device:v1";

/**
 * This browser's id for the practice-time log (D74): random, kept in
 * localStorage. Without storage it lasts for the page, which only means
 * a later visit counts as another device (never double).
 */
let pageDevice: string | null = null;
function deviceId(): string {
  try {
    const saved = window.localStorage.getItem(DEVICE_KEY);
    if (saved) return saved;
    const made = crypto.randomUUID();
    window.localStorage.setItem(DEVICE_KEY, made);
    return made;
  } catch {
    pageDevice ??= crypto.randomUUID();
    return pageDevice;
  }
}

/**
 * Counts the time spent practicing (D74, D181): a second at a time, while
 * lib/practice-time.ts isPracticing says so, each second to the local date
 * it was counted on (lib/practice-time.ts timerTick), saved to the
 * activity log every SAVE_EVERY_MS, at midnight, and when the page is
 * hidden or left. `videoId` is the material, or REVIEW_TIME_KEY.
 * Listening mode keeps counting while its audio plays in the background.
 */
export function usePracticeTimer(
  videoId: string,
  playing: boolean,
  {
    active = true,
    background = false,
  }: {
    /** False while there's nothing to practice (e.g. no words to review). */
    active?: boolean;
    /** Audio playing in the background counts (listening mode, D183). */
    background?: boolean;
  } = {},
) {
  const { rewards } = useStores();
  const playingRef = useRef(playing);
  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  const lastActive = useRef(0);
  useEffect(() => {
    playingRef.current = playing;
    if (playing) lastActive.current = Date.now();
  }, [playing]);

  useEffect(() => {
    lastActive.current = Date.now();
    let state = TIMER_START;
    let lastTick = Date.now();
    const touch = () => {
      lastActive.current = Date.now();
    };
    const write = (flush: TimerFlush | null) => {
      if (!flush) return;
      void updateActivity(rewards, (activity) =>
        addPracticeTime(
          activity,
          flush.date,
          deviceId(),
          videoId,
          flush.seconds,
        ),
      ).catch(() => {});
    };
    const save = () => {
      const result = timerFlush(state);
      state = result.state;
      write(result.flush);
    };
    const tick = window.setInterval(() => {
      const now = Date.now();
      const visible = document.visibilityState === "visible";
      // In front a tick is a second (a jump of the clock, e.g. waking
      // from sleep, adds nothing); a background page's timers slow down,
      // so there it's the time since the last tick (D183).
      const seconds = visible ? 1 : (now - lastTick) / 1000;
      lastTick = now;
      const result = timerTick(state, {
        seconds,
        counting:
          activeRef.current &&
          isPracticing({
            visible,
            focused: document.hasFocus(),
            playing: playingRef.current,
            lastActive: lastActive.current,
            now,
            background,
          }),
        date: toLocalDate(new Date(now)),
      });
      state = result.state;
      write(result.flush);
    }, 1000);
    const onHide = () => {
      if (document.visibilityState === "hidden") save();
    };
    const events = ["keydown", "pointerdown", "input", "wheel"] as const;
    for (const name of events) {
      window.addEventListener(name, touch, { passive: true });
    }
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", save);
    return () => {
      window.clearInterval(tick);
      for (const name of events) window.removeEventListener(name, touch);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", save);
      save();
    };
  }, [rewards, videoId, background]);
}
