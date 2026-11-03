"use client";

import { useEffect, useState } from "react";
import {
  customPracticeId,
  parseCustomPracticeId,
} from "@/lib/practice-material";
import { getBrowserSupabase, type Supabase } from "@/lib/supabase/browser";

/**
 * Titles of the created practices among `ids`, by practice id
 * ("p-<uuid>"). Built-in titles ship with the app; these are read from
 * the account (row level security returns only the user's own). Empty
 * until loaded, or when signed out or offline.
 */
export function useCustomPracticeTitles(
  ids: readonly string[] | null | undefined,
  supabase: Supabase | null = getBrowserSupabase(),
): Record<string, string> {
  const [titles, setTitles] = useState<Record<string, string>>({});
  const uuids = [...new Set(ids ?? [])]
    .map(parseCustomPracticeId)
    .filter((uuid): uuid is string => uuid !== null)
    .sort();
  // A string key, so a new but equal list doesn't fetch again.
  const key = uuids.join(",");

  useEffect(() => {
    if (!key || !supabase) return;
    let cancelled = false;
    supabase
      .from("practices")
      .select("id, title")
      .in("id", key.split(","))
      .then(({ data }) => {
        if (cancelled || !data) return;
        setTitles(
          Object.fromEntries(
            data.map((row) => [customPracticeId(row.id), row.title]),
          ),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [key, supabase]);

  return titles;
}
