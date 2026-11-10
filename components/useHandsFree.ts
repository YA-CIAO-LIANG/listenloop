"use client";

import { useCallback, useSyncExternalStore } from "react";
import { HANDS_FREE_KEY, readHandsFree } from "@/lib/hands-free";

const EVENT = "ll-hands-free";

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

const read = () =>
  readHandsFree(typeof window === "undefined" ? null : window.localStorage);

/**
 * Whether hands-free practice is on for this device (D125), and a setter
 * that every open component hears. On while rendering on the server.
 */
export function useHandsFree(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, read, () => true);
  const set = useCallback((next: boolean) => {
    try {
      if (next) window.localStorage.removeItem(HANDS_FREE_KEY);
      else window.localStorage.setItem(HANDS_FREE_KEY, "off");
    } catch {
      // Storage blocked: the choice lasts until the page closes.
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [on, set];
}
