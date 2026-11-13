import type { MetadataRoute } from "next";
import { PRIVATE_PATHS, SITE_URL } from "@/lib/site";

/**
 * robots.txt (D61, D167): everything public, except personal, admin,
 * sign-in-only pages, endpoints, and practice steps; points to the sitemap.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: [...PRIVATE_PATHS] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
