import { ACCENT_STORAGE_KEY, ACCENTS, DEFAULT_ACCENT } from "./accents";
import {
  BACKGROUND_IDS,
  BACKGROUND_STORAGE_KEY,
  DEFAULT_BACKGROUND,
} from "./background-ids";

export const THEME_STORAGE_KEY = "ll-theme";

export const themePreferences = ["system", "light", "dark"] as const;

export type ThemePreference = (typeof themePreferences)[number];

/** Returns a valid preference, falling back to "system" for missing or unknown values. */
export function parseThemePreference(value: unknown): ThemePreference {
  return themePreferences.includes(value as ThemePreference)
    ? (value as ThemePreference)
    : "system";
}

/**
 * The `data-theme` value for <html>. "system" maps to null so the
 * `prefers-color-scheme` media query in globals.css decides.
 */
export function themeAttribute(
  preference: ThemePreference,
): "light" | "dark" | null {
  return preference === "system" ? null : preference;
}

/**
 * Inline script for <head>. Runs before first paint so a saved light/dark
 * choice (or accent color, D93, or background, D121) never flashes the
 * default. Kept
 * dependency-free because it is serialized into HTML.
 */
export const themeInitScript = `(function(){try{var d=document.documentElement,t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="light"||t==="dark")d.setAttribute("data-theme",t);var a=localStorage.getItem(${JSON.stringify(
  ACCENT_STORAGE_KEY,
)});if(${JSON.stringify(
  ACCENTS.map((accent) => accent.id).filter((id) => id !== DEFAULT_ACCENT),
)}.indexOf(a)>=0)d.setAttribute("data-accent",a);var b=localStorage.getItem(${JSON.stringify(
  BACKGROUND_STORAGE_KEY,
)});if(${JSON.stringify(
  BACKGROUND_IDS.filter((id) => id !== DEFAULT_BACKGROUND),
)}.indexOf(b)>=0)d.setAttribute("data-bg",b)}catch(e){}})()`;
