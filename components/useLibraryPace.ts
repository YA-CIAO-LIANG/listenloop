"use client";

import { useEffect, useState } from "react";
import type { LibraryItem } from "@/lib/library";
import { personalPace } from "@/lib/library-time";
import { useStores } from "./StoresProvider";

/**
 * The learner's pace (D98) from their timed practice in this browser
 * (synced with the account): 1 until there's enough to measure.
 */
export function useLibraryPace(items: readonly LibraryItem[]): number {
  const { rewards } = useStores();
  const [pace, setPace] = useState(1);
  useEffect(() => {
    let cancelled = false;
    rewards
      .getActivity()
      .then((activity) => {
        const materials = new Map(items.map((item) => [item.id, item]));
        if (!cancelled) setPace(personalPace(activity, materials) ?? 1);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [rewards, items]);
  return pace;
}
