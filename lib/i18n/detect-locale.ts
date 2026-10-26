import { defaultLocale, isLocale, type Locale } from "./config";

/**
 * Picks the UI language: an explicit cookie choice wins, then the browser's
 * Accept-Language header, then the default (zh-Hant).
 */
export function detectLocale({
  cookie,
  acceptLanguage,
}: {
  cookie?: string | null;
  acceptLanguage?: string | null;
}): Locale {
  if (isLocale(cookie)) return cookie;
  return matchAcceptLanguage(acceptLanguage) ?? defaultLocale;
}

/**
 * Returns the first supported locale from an Accept-Language header,
 * honoring q-values. Any Chinese variant maps to zh-Hant, the only Chinese UI.
 */
export function matchAcceptLanguage(
  header: string | null | undefined,
): Locale | null {
  if (!header) return null;

  const ranked = header
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const qParam = params.find((p) => p.trim().startsWith("q="));
      const q = qParam ? Number(qParam.trim().slice(2)) : 1;
      return { tag: tag.trim().toLowerCase(), q, index };
    })
    .filter(({ tag, q }) => tag && Number.isFinite(q) && q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);

  for (const { tag } of ranked) {
    if (tag === "zh" || tag.startsWith("zh-")) return "zh-Hant";
    if (tag === "en" || tag.startsWith("en-")) return "en";
  }
  return null;
}
