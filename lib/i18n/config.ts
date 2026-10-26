export const locales = ["zh-Hant", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "zh-Hant";

/** Cookie that stores the user's explicit UI language choice. */
export const LOCALE_COOKIE = "ll-locale";

export function isLocale(value: unknown): value is Locale {
  return locales.includes(value as Locale);
}
