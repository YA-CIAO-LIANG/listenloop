import { describe, expect, it } from "vitest";
import { isLocale } from "@/lib/i18n/config";
import { detectLocale, matchAcceptLanguage } from "@/lib/i18n/detect-locale";

describe("isLocale", () => {
  it("accepts supported locales only", () => {
    expect(isLocale("zh-Hant")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("zh-TW")).toBe(false);
    expect(isLocale("EN")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe("matchAcceptLanguage", () => {
  it.each([
    ["zh-TW,zh;q=0.9,en;q=0.8", "zh-Hant"],
    ["zh-Hant-TW", "zh-Hant"],
    ["zh-CN", "zh-Hant"],
    ["en-US,en;q=0.9", "en"],
    ["en-GB", "en"],
    // q-values outrank header order
    ["en;q=0.5,zh-TW;q=0.9", "zh-Hant"],
    // unsupported languages are skipped
    ["ja-JP,ja;q=0.9,en;q=0.8", "en"],
    // q=0 means "not acceptable"
    ["en;q=0,zh-TW;q=0.1", "zh-Hant"],
    // whitespace and case
    [" EN-us ; q=0.8 ", "en"],
  ])("%s → %s", (header, expected) => {
    expect(matchAcceptLanguage(header)).toBe(expected);
  });

  it.each([null, undefined, "", "ja-JP,ko;q=0.9", "*", "zhx,enx"])(
    "returns null for %j",
    (header) => {
      expect(matchAcceptLanguage(header)).toBeNull();
    },
  );
});

describe("detectLocale", () => {
  it("prefers a valid cookie over the browser language", () => {
    expect(detectLocale({ cookie: "en", acceptLanguage: "zh-TW" })).toBe("en");
    expect(detectLocale({ cookie: "zh-Hant", acceptLanguage: "en-US" })).toBe(
      "zh-Hant",
    );
  });

  it("ignores an invalid cookie", () => {
    expect(detectLocale({ cookie: "fr", acceptLanguage: "en-US" })).toBe("en");
  });

  it("falls back to the browser language, then zh-Hant", () => {
    expect(detectLocale({ acceptLanguage: "en-US" })).toBe("en");
    expect(detectLocale({ acceptLanguage: "ja-JP" })).toBe("zh-Hant");
    expect(detectLocale({})).toBe("zh-Hant");
  });
});
