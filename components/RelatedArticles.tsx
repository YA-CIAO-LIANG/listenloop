import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { blogPath, type BlogPost } from "@/lib/blog";

/** Articles shown at most, newest first. */
const MAX = 3;

/**
 * Articles about this page's topic (D167): links from topic and material
 * pages back to the guides that recommend them. Nothing when there are none.
 */
export async function RelatedArticles({
  posts,
  className,
}: {
  posts: readonly BlogPost[];
  className?: string;
}) {
  if (posts.length === 0) return null;
  const t = await getTranslations("blog");
  return (
    <section aria-labelledby="related-articles" className={className}>
      <h2 id="related-articles" className="font-display text-h3">
        {t("relatedArticles")}
      </h2>
      <ul className="mt-4 space-y-3">
        {posts.slice(0, MAX).map((post) => (
          <li key={post.slug} lang="zh-Hant">
            <Link
              href={blogPath(post.slug)}
              className="tap text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink"
            >
              {post.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
