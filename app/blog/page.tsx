import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { BLOG_POSTS, blogPath } from "@/lib/blog";
import { publicPageMetadata } from "@/i18n/metadata";

/** Title, description, canonical, and hreflang (D167). */
export function generateMetadata(): Promise<Metadata> {
  return publicPageMetadata("/blog");
}

/** Every article (D122), newest first. Public; no sign-in. */
export default async function BlogPage() {
  const [t, format] = await Promise.all([
    getTranslations("blog"),
    getFormatter(),
  ]);
  const posts = [...BLOG_POSTS].sort((a, b) =>
    b.published.localeCompare(a.published),
  );
  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">{t("intro")}</p>
      <ul className="mt-10 max-w-reading divide-y divide-line border-y border-line">
        {posts.map((post) => (
          <li key={post.slug} className="py-6">
            <article lang="zh-Hant">
              <h2 className="font-display text-h3">
                <Link
                  href={blogPath(post.slug)}
                  className="underline-offset-4 hover:underline"
                >
                  {post.title}
                </Link>
              </h2>
              <p className="mt-2 text-supporting text-ink-muted">
                {post.description}
              </p>
              <p className="mt-2 text-metadata text-ink-muted">
                <time dateTime={post.published}>
                  {format.dateTime(new Date(`${post.published}T12:00:00Z`), {
                    dateStyle: "long",
                    timeZone: "UTC",
                  })}
                </time>
              </p>
            </article>
          </li>
        ))}
      </ul>
    </main>
  );
}
