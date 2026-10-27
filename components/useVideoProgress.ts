"use client";

import { useEffect, useState } from "react";
import type { Progress } from "@/lib/progress";
import { createLocalProgressStore } from "@/lib/storage/local-progress-store";
import type { ProgressStore } from "@/lib/storage/progress-store";

/**
 * A video's saved progress, read in the browser. `loaded` is false on the
 * server and until storage answers, so the first render matches the server
 * HTML; unreadable storage counts as no progress. Also returns the store, for
 * pages that save (e.g. starting the next week).
 */
export function useVideoProgress(videoId: string, store?: ProgressStore) {
  const [progressStore] = useState(() => store ?? createLocalProgressStore());
  const [state, setState] = useState<{
    progress: Progress | null;
    loaded: boolean;
  }>({ progress: null, loaded: false });

  useEffect(() => {
    let cancelled = false;
    progressStore
      .get(videoId)
      .catch(() => null)
      .then((progress) => {
        if (!cancelled) setState({ progress, loaded: true });
      });
    return () => {
      cancelled = true;
    };
  }, [progressStore, videoId]);

  return { ...state, store: progressStore };
}
