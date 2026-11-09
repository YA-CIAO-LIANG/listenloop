import type { MetadataRoute } from "next";
import { getVideosByCollection } from "@/lib/video-library";
import { LEARN_CATEGORIES, learnPath } from "@/lib/learn";
import { PUBLIC_PATHS, SITE_URL } from "@/lib/site";

/**
 * sitemap.xml (D61): the public pages and every built-in video's page.
 * Created practices are left out: their own pages decide whether they're
 * indexed (D30), and the list changes often.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const videos = getVideosByCollection().flatMap(({ videos }) => videos);
  return [
    ...PUBLIC_PATHS.map((path) => ({
      url: `${SITE_URL}${path === "/" ? "" : path}`,
      changeFrequency:
        path === "/" || path === "/explore"
          ? ("weekly" as const)
          : ("monthly" as const),
      priority: path === "/" ? 1 : 0.5,
    })),
    // Topic landing pages (D116).
    ...["/learn", ...LEARN_CATEGORIES.map(learnPath)].map((path) => ({
      url: `${SITE_URL}${path}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...videos.map((video) => ({
      url: `${SITE_URL}/videos/${video.id}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
