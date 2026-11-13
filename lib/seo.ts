import type { Metadata } from "next";
import {
  defaultLocale,
  LOCALE_PARAM,
  locales,
  type Locale,
} from "./i18n/config";
import { SITE_URL } from "./site";

/**
 * Search engine metadata (D167). The interface language is a cookie, not
 * part of the address, so each language also has its own address for
 * crawlers: the default (zh-Hant) at the clean URL, English at `?hl=en`
 * (proxy.ts shows that request in English without saving a cookie).
 *
 * - canonical: the address of the language being shown, so each language
 *   version points at itself (Google ignores hreflang between pages whose
 *   canonicals point elsewhere);
 * - hreflang: zh-Hant → clean URL, en → `?hl=en`, x-default → clean URL.
 */

/** A page's absolute address in one language. */
export function localizedUrl(path: string, locale: Locale): string {
  const base = `${SITE_URL}${path === "/" ? "/" : path}`;
  return locale === defaultLocale ? base : `${base}?${LOCALE_PARAM}=${locale}`;
}

/** hreflang alternates: every language plus x-default. */
export function languageAlternates(path: string): Record<string, string> {
  return {
    ...Object.fromEntries(
      locales.map((locale) => [locale, localizedUrl(path, locale)]),
    ),
    "x-default": localizedUrl(path, defaultLocale),
  };
}

/** Open Graph's locale names. */
export const ogLocale = (locale: Locale) =>
  locale === "en" ? "en_US" : "zh_TW";

export type SeoInput = {
  /** The page's path, e.g. "/learn/travel" ("/" for the home page). */
  path: string;
  /** The language this request is shown in. */
  locale: Locale;
  title: string;
  description: string;
  siteName: string;
  /** Use the title as is, without " · ListenLoop" (the home page). */
  absoluteTitle?: boolean;
  type?: "website" | "article";
  publishedTime?: string;
  /**
   * The main text is in one language whatever the interface (articles are
   * written in Traditional Chinese): only that language is listed, and
   * every interface language points its canonical at it.
   */
  contentLocale?: Locale;
};

/**
 * Title, description, canonical, hreflang, Open Graph, and Twitter card
 * for an indexable page. The share image comes from the nearest
 * opengraph-image.tsx (file-based metadata wins over this).
 */
export function seoMetadata(input: SeoInput): Metadata {
  const { path, locale, title, description, siteName } = input;
  const shown = input.contentLocale ?? locale;
  const canonical = localizedUrl(path, shown);
  const languages = input.contentLocale
    ? {
        [input.contentLocale]: canonical,
        "x-default": canonical,
      }
    : languageAlternates(path);
  return {
    title: input.absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical, languages },
    openGraph: {
      type: input.type ?? "website",
      siteName,
      title,
      description,
      url: canonical,
      locale: ogLocale(shown),
      ...(input.type === "article" && input.publishedTime
        ? { publishedTime: input.publishedTime }
        : {}),
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

/**
 * The fixed public pages (not per topic, article, or material), with the
 * message keys of their title and description: one list for the pages'
 * metadata, the sitemap, and the test that every title and description is
 * unique.
 */
export const PUBLIC_PAGES = [
  {
    path: "/",
    title: "metadata.homeTitle",
    description: "metadata.description",
  },
  { path: "/explore", title: "explore.title", description: "explore.intro" },
  {
    path: "/level-test",
    title: "levelTest.title",
    description: "levelTest.intro",
  },
  {
    path: "/learn",
    title: "learn.indexTitle",
    description: "learn.indexIntro",
  },
  { path: "/blog", title: "blog.title", description: "blog.intro" },
  { path: "/faq", title: "faq.title", description: "faq.intro" },
  { path: "/pricing", title: "pricing.title", description: "pricing.intro" },
  {
    path: "/pricing/classroom",
    title: "classPricing.title",
    description: "classPricing.intro",
  },
  { path: "/terms", title: "terms.title", description: "terms.intro" },
  { path: "/privacy", title: "privacy.title", description: "privacy.intro" },
  { path: "/refund", title: "refund.title", description: "refund.intro" },
  { path: "/credits", title: "credits.title", description: "credits.intro" },
  { path: "/feedback", title: "feedback.title", description: "feedback.intro" },
  {
    path: "/status",
    title: "ops.status.title",
    description: "ops.status.intro",
  },
] as const;

export type PublicPagePath = (typeof PUBLIC_PAGES)[number]["path"];

export const findPublicPage = (path: PublicPagePath) =>
  PUBLIC_PAGES.find((page) => page.path === path)!;

/**
 * JSON-LD as text that is safe inside a <script> element: "<", ">", "&",
 * and the two line separators are escaped, so no text from a title or
 * description can close the element or start markup.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .split(LINE_SEPARATOR)
    .join("\\u2028")
    .split(PARAGRAPH_SEPARATOR)
    .join("\\u2029");
}

const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

/**
 * Text the share image can draw: its built-in font has Latin letters only
 * (no Chinese), and anything else would make it fetch fonts at render
 * time. Keeps printable ASCII and common punctuation, trims to `max`.
 */
export function ogText(text: string, max = 90): string {
  const clean = text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > max ? `${clean.slice(0, max - 3).trimEnd()}...` : clean;
}
