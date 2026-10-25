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
 * choice never flashes the other theme. Kept dependency-free because it is
 * serialized into HTML.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;
