"use client";

import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import {
  THEME_STORAGE_KEY,
  parseThemePreference,
  themeAttribute,
  themePreferences,
  type ThemePreference,
} from "@/lib/theme";
import { SegmentedControl } from "./SegmentedControl";

const listeners = new Set<() => void>();

function readPreference(): ThemePreference {
  try {
    return parseThemePreference(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

function applyAttribute(preference: ThemePreference) {
  const attribute = themeAttribute(preference);
  if (attribute) {
    document.documentElement.setAttribute("data-theme", attribute);
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

function setPreference(preference: ThemePreference) {
  try {
    if (preference === "system") {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      localStorage.setItem(THEME_STORAGE_KEY, preference);
    }
  } catch {
    // Storage blocked (e.g. private mode): still apply for this page view.
  }
  applyAttribute(preference);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  // Keep tabs in sync when another tab changes the theme.
  function onStorage(event: StorageEvent) {
    if (event.key !== THEME_STORAGE_KEY) return;
    applyAttribute(parseThemePreference(event.newValue));
    listener();
  }
  listeners.add(listener);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** System / light / dark choice, saved in localStorage (see lib/theme.ts). */
export function ThemeToggle() {
  const t = useTranslations("settings.theme");
  // The server can't read localStorage, so it renders "system"; the client
  // switches to the saved value right after hydration without a mismatch.
  const preference = useSyncExternalStore(
    subscribe,
    readPreference,
    () => "system" as const,
  );

  return (
    <SegmentedControl
      legend={t("label")}
      value={preference}
      options={themePreferences.map((value) => ({ value, label: t(value) }))}
      onChange={setPreference}
      optionWidthClassName="min-w-20"
    />
  );
}
