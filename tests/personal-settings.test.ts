import { describe, expect, it } from "vitest";
import {
  applyLook,
  applySettings,
  clearPersonalData,
  mergeSettings,
  parseSettingsDocument,
  PERSONAL_SETTING_KEYS,
  readSettings,
  SETTINGS_AT_KEY,
} from "@/lib/personal-settings";
import { ACCOUNT_KEY } from "@/lib/sync/sync";

/** Personal settings belong to an account (D138). */
function memoryStorage(entries: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(entries));
  return {
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
  };
}

describe("personal settings (D138)", () => {
  it("clears everything personal at sign-out, keeps the device's own", () => {
    const storage = memoryStorage({
      "ll-background": "ocean",
      "ll-accent": "teal",
      "ll-theme": "dark",
      "ll-library-default:v1": "level=beginner",
      "ll-progress:v1:sintel": "{}",
      "ll-activity:v1": "{}",
      "ll-wallet:v1": "{}",
      "ll-level-test:v1": "{}",
      [ACCOUNT_KEY]: "{}",
      [SETTINGS_AT_KEY]: "5",
      "ll-device:v1": "device-1",
      "ll-gen-speed:v1": "{}",
    });
    clearPersonalData(storage);
    expect(
      Array.from({ length: storage.length }, (_, i) => storage.key(i)),
    ).toEqual(["ll-device:v1", "ll-gen-speed:v1"]);
  });

  it("reads, checks, and applies the account's copy exactly", () => {
    const storage = memoryStorage({
      "ll-background": "ocean",
      "ll-accent": "teal",
    });
    expect(readSettings(storage)).toEqual({
      values: { "ll-background": "ocean", "ll-accent": "teal" },
      at: 0,
    });
    applySettings(storage, { values: { "ll-theme": "dark" }, at: 9 });
    expect(readSettings(storage)).toEqual({
      values: { "ll-theme": "dark" },
      at: 9,
    });
    expect(
      parseSettingsDocument({
        values: { "ll-theme": "dark", other: "x" },
        at: 3,
      }),
    ).toEqual({ values: { "ll-theme": "dark" }, at: 3 });
    expect(parseSettingsDocument({ values: {} })).toBeNull();
    expect(PERSONAL_SETTING_KEYS).toContain("ll-hands-free:v1");
  });

  it("on another account's device the account wins; on its own, the newer", () => {
    const local = { values: { "ll-background": "ocean" }, at: 10 };
    const cloud = { values: { "ll-background": "forest" }, at: 5 };
    expect(mergeSettings(local, cloud, false)).toEqual({
      use: cloud,
      toLocal: true,
      toCloud: false,
    });
    expect(mergeSettings(local, cloud, true)).toEqual({
      use: local,
      toLocal: false,
      toCloud: true,
    });
    expect(mergeSettings(local, null, false)).toEqual({
      use: local,
      toLocal: false,
      toCloud: true,
    });
  });

  it("puts the look on the page again", () => {
    const attributes = new Map<string, string>([["data-bg", "ocean"]]);
    const root = {
      setAttribute: (k: string, v: string) => void attributes.set(k, v),
      removeAttribute: (k: string) => void attributes.delete(k),
      getAttribute: (k: string) => attributes.get(k) ?? null,
    } as unknown as HTMLElement;
    applyLook(memoryStorage({ "ll-accent": "teal", "ll-theme": "dark" }), root);
    expect(root.getAttribute("data-bg")).toBeNull();
    expect(root.getAttribute("data-accent")).toBe("teal");
    expect(root.getAttribute("data-theme")).toBe("dark");
  });
});
