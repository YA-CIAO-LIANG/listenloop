"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { setLocale } from "@/i18n/actions";
import { LOCALE_PARAM, type Locale } from "@/lib/i18n/config";
import { SegmentedControl } from "./SegmentedControl";

/** 中文 / EN switch. Saves a cookie via a Server Action; the page re-renders. */
export function LanguageToggle() {
  const t = useTranslations("settings.language");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Show the new choice immediately while the server re-renders.
  const [optimisticLocale, setOptimisticLocale] = useOptimistic(locale);

  function change(next: Locale) {
    startTransition(async () => {
      setOptimisticLocale(next);
      await setLocale(next);
      // A `?hl=` address (from a search result, D167) would keep showing
      // its language over the saved choice: go to the plain address.
      const url = new URL(window.location.href);
      if (url.searchParams.has(LOCALE_PARAM)) {
        url.searchParams.delete(LOCALE_PARAM);
        router.replace(`${url.pathname}${url.search}${url.hash}`);
      }
    });
  }

  return (
    <SegmentedControl
      legend={t("label")}
      value={optimisticLocale}
      options={[
        { value: "zh-Hant", label: t("zhHant"), lang: "zh-Hant" },
        { value: "en", label: t("en"), lang: "en" },
      ]}
      onChange={change}
      busy={isPending}
      optionWidthClassName="min-w-12"
    />
  );
}
