import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LOCALE_COOKIE } from "@/lib/i18n/config";
import { detectLocale } from "@/lib/i18n/detect-locale";
import { TIME_ZONE_COOKIE, timeZoneOr } from "@/lib/time-zone";

// Loaded by the next-intl plugin (next.config.ts) for every request.
export default getRequestConfig(async () => {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const locale = detectLocale({
    cookie: cookieStore.get(LOCALE_COOKIE)?.value,
    acceptLanguage: headerStore.get("accept-language"),
  });

  return {
    locale,
    // Dates the server writes into pages, in the learner's zone (D139).
    timeZone: timeZoneOr(
      decodeURIComponent(cookieStore.get(TIME_ZONE_COOKIE)?.value ?? ""),
    ),
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
