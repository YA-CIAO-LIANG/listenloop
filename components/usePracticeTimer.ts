"use client";

import { useEffect, useRef } from "react";
import { updateActivity } from "@/lib/claim-rewards";
import { toLocalDate } from "@/lib/dates";
import {
  addPracticeTime,
  isPracticing,
  SAVE_EVERY_MS,
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
 * Counts the time spent on a practice page (D74): a second at a time,
 * while lib/practice-time.ts isPracticing says so, saved to the activity
 * log every SAVE_EVERY_MS and when the page is hidden or left.
 */
export function usePracticeTimer(
  videoId: string,
  playing: boolean,
  /** Count playing in the background too (listening mode, D135). */
  { background = false }: { background?: boolean } = {},
) {
  const { rewards } = useStores();
  const playingRef = useRef(playing);
  const lastActive = useRef(0);
  useEffect(() => {
    playingRef.current = playing;
    if (playing) lastActive.current = Date.now();
  }, [playing]);

  useEffect(() => {
    lastActive.current = Date.now();
    let pending = 0;
    let sinceSave = 0;
    const touch = () => {
      lastActive.current = Date.now();
    };
    const save = () => {
      if (pending <= 0) return;
      const seconds = pending;
      pending = 0;
      sinceSave = 0;
      void updateActivity(rewards, (activity) =>
        addPracticeTime(
          activity,
          toLocalDate(new Date()),
          deviceId(),
          videoId,
          seconds,
        ),
      ).catch(() => {});
    };
    const tick = window.setInterval(() => {
      const counting = isPracticing({
        visible: document.visibilityState === "visible",
        focused: document.hasFocus(),
        playing: playingRef.current,
        lastActive: lastActive.current,
        now: Date.now(),
        background,
      });
      if (!counting) return;
      pending += 1;
      sinceSave += 1000;
      if (sinceSave >= SAVE_EVERY_MS) save();
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
