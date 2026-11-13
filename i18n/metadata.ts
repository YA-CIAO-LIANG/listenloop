import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { defaultLocale, isLocale, type Locale } from "@/lib/i18n/config";
import {
  findPublicPage,
  seoMetadata,
  type PublicPagePath,
  type SeoInput,
} from "@/lib/seo";

/** This request's interface language (D167: `?hl=` or the cookie). */
export async function requestLocale(): Promise<Locale> {
  const locale = await getLocale();
  return isLocale(locale) ? locale : defaultLocale;
}

/**
 * Metadata for a page with its own title and description (D167): adds
 * this request's language and the site's name to `seoMetadata`.
 */
export async function seoFor(
  input: Omit<SeoInput, "locale" | "siteName">,
): Promise<Metadata> {
  const [t, locale] = await Promise.all([
    getTranslations("metadata"),
    requestLocale(),
  ]);
  return seoMetadata({ ...input, locale, siteName: t("siteName") });
}

/** Metadata for one of the fixed public pages (lib/seo.ts PUBLIC_PAGES). */
export async function publicPageMetadata(
  path: PublicPagePath,
): Promise<Metadata> {
  const t = await getTranslations();
  const page = findPublicPage(path);
  return seoFor({
    path,
    title: t(page.title),
    description: t(page.description),
    absoluteTitle: path === "/",
  });
}
