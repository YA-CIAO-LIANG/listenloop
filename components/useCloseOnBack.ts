"use client";

import { useEffect, useRef } from "react";

type CloseWatcherLike = { onclose: (() => void) | null; destroy(): void };

/**
 * While `open`, Android's back button (and back gesture) closes the menu
 * instead of leaving the page (D178), via Chrome's CloseWatcher; native
 * <dialog>s (components/Dialog.tsx) already do this. Browsers without
 * CloseWatcher keep their usual back. CloseWatcher also listens for
 * Escape: callers that handle Escape themselves call preventDefault on
 * it, so close runs once.
 */
export function useCloseOnBack(open: boolean, onClose: () => void) {
  const latest = useRef(onClose);
  useEffect(() => {
    latest.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const Watcher = (
      window as unknown as { CloseWatcher?: new () => CloseWatcherLike }
    ).CloseWatcher;
    if (!Watcher) return;
    let watcher: CloseWatcherLike;
    try {
      watcher = new Watcher();
    } catch {
      return;
    }
    watcher.onclose = () => latest.current();
    return () => watcher.destroy();
  }, [open]);
}
