import type { Locale } from "@/lib/i18n/config";
import type messages from "./messages/zh-Hant.json";

// Type-safe translation keys: a typo in t("...") fails `npm run typecheck`.
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
