"use client";

import { settingsChanged } from "@/lib/personal-settings";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { saveLibraryDefault } from "@/app/library-actions";
import {
  activeFilterCount,
  hasLibraryParams,
  NO_LIBRARY_FILTER,
  parseSavedFilter,
  savedFilterString,
  type LibraryFilter,
} from "@/lib/library";
import { LIBRARY_DEFAULT_STORAGE_KEY } from "@/lib/library-config";
import { LEVEL_TEST_KEY, parseSavedLevelTest } from "@/lib/level-test";
import { Button } from "./Button";

type Save = (value: string | null) => Promise<{ ok: boolean }>;

// The browser's saved default, read like an external store so the server
// render (no storage) and the first client render agree.
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The level from this device's level test (D109, D146), if any. */
function readLevelTest() {
  try {
    return parseSavedLevelTest(localStorage.getItem(LEVEL_TEST_KEY))?.level;
  } catch {
    return undefined;
  }
}

function readLocal(): string | null {
  try {
    return localStorage.getItem(LIBRARY_DEFAULT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeLocal(value: string | null) {
  try {
    if (value === null) localStorage.removeItem(LIBRARY_DEFAULT_STORAGE_KEY);
    else localStorage.setItem(LIBRARY_DEFAULT_STORAGE_KEY, value);
    settingsChanged();
  } catch {
    // Not remembered in this browser.
  }
  listeners.forEach((listener) => listener());
}

/**
 * "My default filter" (D98): applies the saved one once when the library
 * opens with no filter in its URL, and saves or clears it. Signed in
 * (`fromAccount` is a string or null), it lives in the account; signed
 * out (undefined), in this browser.
 */
export function useLibraryDefault(
  fromAccount: string | null | undefined,
  apply: (filter: LibraryFilter) => void,
  save: Save = saveLibraryDefault,
) {
  const searchParams = useSearchParams();
  const signedIn = fromAccount !== undefined;
  const [inAccount, setInAccount] = useState<string | null>(
    fromAccount ?? null,
  );
  const inBrowser = useSyncExternalStore(subscribe, readLocal, () => null);
  const saved = signedIn ? inAccount : inBrowser;
  const applied = useRef(false);

  useEffect(() => {
    if (applied.current) return;
    applied.current = true;
    if (hasLibraryParams(searchParams)) return;
    const filter = parseSavedFilter(signedIn ? fromAccount : readLocal());
    if (filter) {
      apply(filter);
      return;
    }
    // No default of one's own: the level test's result is the starting
    // level (D146).
    const level = readLevelTest();
    if (level) apply({ ...NO_LIBRARY_FILTER, levels: [level] });
  }, [signedIn, fromAccount, searchParams, apply]);

  async function store(value: string | null): Promise<boolean> {
    if (!signedIn) {
      writeLocal(value);
      return true;
    }
    const result = await save(value).catch(() => ({ ok: false }));
    if (result.ok) setInAccount(value);
    return result.ok;
  }

  return { saved, signedIn, store };
}

/** The buttons under the filters: save these as my default, or clear it. */
export function LibraryDefaultControls({
  filter,
  saved,
  signedIn,
  store,
}: {
  filter: LibraryFilter;
  saved: string | null;
  signedIn: boolean;
  store: (value: string | null) => Promise<boolean>;
}) {
  const t = useTranslations("library.defaults");
  const [status, setStatus] = useState<"saved" | "cleared" | "failed" | null>(
    null,
  );
  const current = savedFilterString({ ...filter, query: "" });
  const isDefault = saved !== null && saved === current;
  const empty = activeFilterCount(filter) === 0;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={empty || isDefault}
          onClick={async () =>
            setStatus((await store(current)) ? "saved" : "failed")
          }
        >
          {isDefault ? t("isDefault") : t("save")}
        </Button>
        {saved !== null && (
          <Button
            variant="ghost"
            size="sm"
            onClick={async () =>
              setStatus((await store(null)) ? "cleared" : "failed")
            }
          >
            {t("clear")}
          </Button>
        )}
      </div>
      <p role="status" className="text-supporting text-ink-muted">
        {status === "saved"
          ? t(signedIn ? "savedAccount" : "savedBrowser")
          : status === "cleared"
            ? t("cleared")
            : status === "failed"
              ? t("failed")
              : null}
      </p>
    </div>
  );
}
