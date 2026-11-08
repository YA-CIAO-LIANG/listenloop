"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  parseSpeed,
  SPEED_STORAGE_KEY,
  type MeasuredSpeed,
} from "@/lib/custom-practice/estimate";

const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
// The raw string, so the snapshot stays the same between reads.
function readRaw(): string | null {
  try {
    return localStorage.getItem(SPEED_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * How fast this device has seen practices get ready (D95), remembered in
 * this browser; null until it has made one (or on the server).
 */
export function useMeasuredSpeed(): [
  MeasuredSpeed | null,
  (next: MeasuredSpeed | null) => void,
] {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  let measured: MeasuredSpeed | null = null;
  try {
    measured = raw ? parseSpeed(JSON.parse(raw)) : null;
  } catch {
    measured = null;
  }
  const save = useCallback((next: MeasuredSpeed | null) => {
    if (!next) return;
    try {
      localStorage.setItem(SPEED_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Not remembered; the default guess stays.
    }
    listeners.forEach((listener) => listener());
  }, []);
  return [measured, save];
}

/** The time now, ticking every second while `active` (for "time left"). */
export function useNow(active: boolean): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}
