import { writingPrompts } from "@/data/writing";
import type { MetadataRoute } from "next";
import { getOfficialPractices } from "@/auth/library";
import { BLOG_POSTS, blogPath } from "@/lib/blog";
import { defaultLocale } from "@/lib/i18n/config";
import { LEARN_CATEGORIES, learnPath } from "@/lib/learn";
import { languageAlternates, localizedUrl, PUBLIC_PAGES } from "@/lib/seo";
import { getAllVideos } from "@/lib/video-library";

type Entry = MetadataRoute.Sitemap[number];

/**
 * Made on request (the library read is cached for 5 minutes), never at
 * build time: the build has no database, and a list read there would be
 * cached empty for the pages that share it (D167).
 */
export const dynamic = "force-dynamic";

/** One address with its languages (hreflang, D167). */
const entry = (
  path: string,
  changeFrequency: Entry["changeFrequency"],
  priority: number,
  options: { lastModified?: string; oneLanguage?: boolean } = {},
): Entry => ({
  url: localizedUrl(path, defaultLocale),
  ...(options.lastModified ? { lastModified: options.lastModified } : {}),
  changeFrequency,
  priority,
  ...(options.oneLanguage
    ? {}
    : { alternates: { languages: languageAlternates(path) } }),
});

/** Pages people come back to more often than the legal ones. */
const WEEKLY = new Set<string>(["/", "/explore", "/learn", "/blog"]);

/**
 * sitemap.xml (D61, D167): the public pages, topic pages, articles, and
 * every indexable material — built-in videos (drafts left out) and
 * official materials (from the same cached list as the library).
 * Learners' own and shared practices are left out: they're noindex
 * (D30), and the list changes often.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const official = await getOfficialPractices().catch(() => []);
  return [
    ...PUBLIC_PAGES.map(({ path }) =>
      entry(
        path,
        WEEKLY.has(path) ? "weekly" : "monthly",
        path === "/" ? 1 : WEEKLY.has(path) ? 0.8 : 0.4,
      ),
    ),
    // Topic landing pages (D116).
    ...LEARN_CATEGORIES.map((category) =>
      entry(learnPath(category), "weekly", 0.8),
    ),
    // Articles (D122): written in Traditional Chinese only.
    ...BLOG_POSTS.map((post) =>
      entry(blogPath(post.slug), "monthly", 0.7, {
        lastModified: post.published,
        oneLanguage: true,
      }),
    ),
    ...getAllVideos().map((video) =>
      entry(`/videos/${video.id}`, "monthly", 0.7),
    ),
    ...official.map((practice) =>
      entry(`/videos/${practice.id}`, "monthly", 0.7),
    ),
    // WritingLoop (D187): its home and every official prompt.
    entry("/writing", "weekly", 0.8),
    ...writingPrompts.map((prompt) =>
      entry(`/writing/${prompt.id}`, "monthly", 0.6),
    ),
  ];
}
