import { ACCENT_STORAGE_KEY, DEFAULT_ACCENT } from "./accents";
import { BACKGROUND_STORAGE_KEY, DEFAULT_BACKGROUND } from "./background-ids";
import { HANDS_FREE_KEY } from "./hands-free";
import { LEVEL_TEST_KEY } from "./level-test";
import { MATERIALS_VIEW_KEY } from "./material-folders";
import { LIBRARY_DEFAULT_STORAGE_KEY } from "./library-config";
import { LISTEN_STORAGE_KEY } from "./listen";
import { LOOP_STORAGE_KEY } from "./player/loop";
import { THEME_STORAGE_KEY } from "./theme";

/**
 * Personal settings belong to an account (D138): kept on this device for
 * speed, copied to the account (user_documents "settings") so they follow
 * it, cleared when someone signs out, and loaded when someone signs in.
 * The device's own things (its id, measured speed, the interface
 * language cookie) stay.
 */
export const PERSONAL_SETTING_KEYS = [
  THEME_STORAGE_KEY,
  ACCENT_STORAGE_KEY,
  BACKGROUND_STORAGE_KEY,
  LIBRARY_DEFAULT_STORAGE_KEY,
  LISTEN_STORAGE_KEY,
  HANDS_FREE_KEY,
  LOOP_STORAGE_KEY,
  // My materials' grid or list (D147).
  MATERIALS_VIEW_KEY,
] as const;

/** When this device's settings last changed (ms), to merge with the account's. */
export const SETTINGS_AT_KEY = "ll-settings-at:v1";

/** Practice data that's the account's, in its cloud (cleared at sign-out). */
const PERSONAL_DATA_KEYS = [
  "ll-activity:v1",
  "ll-wallet:v1",
  LEVEL_TEST_KEY,
  // lib/sync/sync.ts ACCOUNT_KEY (not imported: sync imports this file).
  "ll-account:v1",
  SETTINGS_AT_KEY,
];
const PERSONAL_DATA_PREFIXES = ["ll-progress:v1:"];

export const SETTINGS_DOCUMENT = "settings";

/** The account's copy: each setting's stored text, and when it changed. */
export type SettingsDocument = { values: Record<string, string>; at: number };

type Storage = Pick<
  globalThis.Storage,
  "getItem" | "setItem" | "removeItem" | "key" | "length"
>;

export function readSettings(storage: Storage): SettingsDocument {
  const values: Record<string, string> = {};
  for (const key of PERSONAL_SETTING_KEYS) {
    const value = storage.getItem(key);
    if (value !== null) values[key] = value;
  }
  return { values, at: Number(storage.getItem(SETTINGS_AT_KEY)) || 0 };
}

export function parseSettingsDocument(value: unknown): SettingsDocument | null {
  if (typeof value !== "object" || value === null) return null;
  const data = value as Record<string, unknown>;
  if (typeof data.at !== "number" || typeof data.values !== "object") {
    return null;
  }
  const values: Record<string, string> = {};
  for (const key of PERSONAL_SETTING_KEYS) {
    const v = (data.values as Record<string, unknown> | null)?.[key];
    if (typeof v === "string" && v.length <= 2000) values[key] = v;
  }
  return { values, at: data.at };
}

/** Makes this device's settings exactly `settings` (missing ones removed). */
export function applySettings(storage: Storage, settings: SettingsDocument) {
  for (const key of PERSONAL_SETTING_KEYS) {
    const value = settings.values[key];
    if (value === undefined) storage.removeItem(key);
    else storage.setItem(key, value);
  }
  storage.setItem(SETTINGS_AT_KEY, String(settings.at));
}

/** Removes everything personal from this device (signing out, D138). */
export function clearPersonalData(storage: Storage) {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (
      key &&
      ((PERSONAL_SETTING_KEYS as readonly string[]).includes(key) ||
        PERSONAL_DATA_KEYS.includes(key) ||
        PERSONAL_DATA_PREFIXES.some((prefix) => key.startsWith(prefix)))
    ) {
      keys.push(key);
    }
  }
  for (const key of keys) storage.removeItem(key);
}

/**
 * Which side wins at sync (D138): on another account's device or a
 * guest's, the account's (if it has any; a guest's choices otherwise go
 * up); on its own device, the newer.
 */
export function mergeSettings(
  local: SettingsDocument,
  cloud: SettingsDocument | null,
  sameAccount: boolean,
): { use: SettingsDocument; toLocal: boolean; toCloud: boolean } {
  if (!cloud) return { use: local, toLocal: false, toCloud: true };
  if (!sameAccount || cloud.at >= local.at) {
    const differs =
      JSON.stringify(cloud.values) !== JSON.stringify(local.values);
    return {
      use: cloud,
      toLocal: differs || cloud.at !== local.at,
      toCloud: false,
    };
  }
  return { use: local, toLocal: false, toCloud: true };
}

export const SETTINGS_EVENT = "ll-settings-changed";

/**
 * Every place that saves a personal setting calls this: it stamps the
 * change and tells the signed-in page to copy the settings to the account.
 */
export function settingsChanged() {
  try {
    localStorage.setItem(SETTINGS_AT_KEY, String(Date.now()));
    window.dispatchEvent(new Event(SETTINGS_EVENT));
  } catch {
    // Storage blocked: nothing to copy.
  }
}

/** Puts the look settings on <html> again (after they were replaced). */
export function applyLook(storage: Storage, root: HTMLElement) {
  const set = (attribute: string, value: string | null, fallback: string) => {
    if (value && value !== fallback) root.setAttribute(attribute, value);
    else root.removeAttribute(attribute);
  };
  const theme = storage.getItem(THEME_STORAGE_KEY);
  set("data-theme", theme === "light" || theme === "dark" ? theme : null, "");
  set("data-accent", storage.getItem(ACCENT_STORAGE_KEY), DEFAULT_ACCENT);
  set("data-bg", storage.getItem(BACKGROUND_STORAGE_KEY), DEFAULT_BACKGROUND);
}
