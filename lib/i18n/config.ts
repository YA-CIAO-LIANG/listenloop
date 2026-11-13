export const locales = ["zh-Hant", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "zh-Hant";

/** Cookie that stores the user's explicit UI language choice. */
export const LOCALE_COOKIE = "ll-locale";

export function isLocale(value: unknown): value is Locale {
  return locales.includes(value as Locale);
}

/**
 * `?hl=en` / `?hl=zh-Hant` (D167): shows the page in that language for
 * this request only, so search engines can fetch each language at its own
 * address (there's no locale prefix in URLs). Not saved in the cookie.
 */
export const LOCALE_PARAM = "hl";

/** Request header the proxy sets from LOCALE_PARAM for i18n/request.ts. */
export const LOCALE_OVERRIDE_HEADER = "x-ll-locale";
