import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import zhHant from "@/messages/zh-Hant.json";

/**
 * Flattens nested messages into { "settings.theme.label": "..." }. Lists
 * (e.g. privacy.sections, read with t.raw) flatten by index.
 */
function flatten(messages: object, prefix = ""): Record<string, string> {
  return Object.entries(messages).reduce<Record<string, string>>(
    (flat, [key, value]: [string, unknown]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof value === "string") return { ...flat, [path]: value };
      if (typeof value === "object" && value !== null) {
        return { ...flat, ...flatten(value, path) };
      }
      return flat;
    },
    {},
  );
}

/**
 * ICU argument names, e.g. "第 {day} 天" → ["day"]. A name must be followed
 * by "}" or ",", so words inside plural/select branches ("{no tasks}") don't
 * count.
 */
function argumentNames(message: string): string[] {
  return [...message.matchAll(/\{\s*(\w+)\s*[,}]/g)].map((m) => m[1]).sort();
}

const catalogs = { "zh-Hant": flatten(zhHant), en: flatten(en) };

describe("messages", () => {
  it("zh-Hant and en have exactly the same keys", () => {
    expect(Object.keys(catalogs.en).sort()).toEqual(
      Object.keys(catalogs["zh-Hant"]).sort(),
    );
  });

  it.each(Object.entries(catalogs))("%s has no empty strings", (_, flat) => {
    const empty = Object.entries(flat)
      .filter(([, value]) => value.trim() === "")
      .map(([key]) => key);
    expect(empty).toEqual([]);
  });

  it("each key uses the same ICU arguments in both languages", () => {
    for (const [key, zh] of Object.entries(catalogs["zh-Hant"])) {
      expect(argumentNames(catalogs.en[key] ?? ""), key).toEqual(
        argumentNames(zh),
      );
    }
  });
});
