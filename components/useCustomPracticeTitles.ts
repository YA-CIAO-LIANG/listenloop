"use client";

import { oneLineTitle, practiceTitles } from "@/lib/titles";
import { useEffect, useState } from "react";
import {
  customPracticeId,
  parseCustomPracticeId,
} from "@/lib/practice-material";
import { loadBrowserSupabase } from "@/lib/supabase/browser";

/**
 * Titles of the created practices among `ids`, by practice id
 * ("p-<uuid>"). Built-in titles ship with the app; these are read from
 * the account (row level security returns only the user's own). Empty
 * until loaded, or when signed out or offline.
 */
export function useCustomPracticeTitles(
  ids: readonly string[] | null | undefined,
  load: typeof loadBrowserSupabase = loadBrowserSupabase,
): Record<string, string> {
  const [titles, setTitles] = useState<Record<string, string>>({});
  const uuids = [...new Set(ids ?? [])]
    .map(parseCustomPracticeId)
    .filter((uuid): uuid is string => uuid !== null)
    .sort();
  // A string key, so a new but equal list doesn't fetch again.
  const key = uuids.join(",");

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    load()
      .then((supabase) =>
        supabase
          ?.from("practices")
          .select("id, title, title_en, title_zh")
          .in("id", key.split(",")),
      )
      .then((result) => {
        const data = result?.data;
        if (cancelled || !data) return;
        setTitles(
          Object.fromEntries(
            data.map((row) => [
              customPracticeId(row.id),
              oneLineTitle(practiceTitles(row)),
            ]),
          ),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [key, load]);

  return titles;
}
