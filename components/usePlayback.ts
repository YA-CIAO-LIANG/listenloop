"use client";

import { useCallback, useSyncExternalStore } from "react";
import { settingsChanged, SETTINGS_EVENT } from "@/lib/personal-settings";
import {
  DEFAULT_PLAYBACK,
  parsePlayback,
  PLAYBACK_KEY,
  type Playback,
} from "@/lib/playback";

const PLAYBACK_EVENT = "ll-playback-changed";

function subscribe(onChange: () => void) {
  window.addEventListener(PLAYBACK_EVENT, onChange);
  window.addEventListener(SETTINGS_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(PLAYBACK_EVENT, onChange);
    window.removeEventListener(SETTINGS_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function read(): string | null {
  try {
    return localStorage.getItem(PLAYBACK_KEY);
  } catch {
    return null;
  }
}

/**
 * The playback settings (D220), the same in every practice page and kept
 * when changed: `change` saves at once (this browser, and the account
 * when signed in) and every page using them follows.
 */
export function usePlayback(): [Playback, (next: Partial<Playback>) => void] {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  const playback = raw === null ? DEFAULT_PLAYBACK : parsePlayback(raw);
  const change = useCallback((next: Partial<Playback>) => {
    try {
      const current = parsePlayback(localStorage.getItem(PLAYBACK_KEY));
      localStorage.setItem(
        PLAYBACK_KEY,
        JSON.stringify({ ...current, ...next }),
      );
      window.dispatchEvent(new Event(PLAYBACK_EVENT));
      settingsChanged();
    } catch {
      // Storage blocked: the setting lasts this page only.
    }
  }, []);
  return [playback, change];
}
