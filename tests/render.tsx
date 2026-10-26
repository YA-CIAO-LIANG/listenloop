import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import type { Locale } from "@/lib/i18n/config";
import en from "@/messages/en.json";
import zhHant from "@/messages/zh-Hant.json";

const messages = { "zh-Hant": zhHant, en };

/** Renders a component with the real messages for the given locale. */
export function renderWithIntl(ui: ReactElement, locale: Locale = "zh-Hant") {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      {ui}
    </NextIntlClientProvider>,
  );
}
