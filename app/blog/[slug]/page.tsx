import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { getLibraryItems } from "@/auth/library";
import { ButtonLink } from "@/components/ButtonLink";
import { MaterialCard } from "@/components/MaterialCard";
import { blogFile, blogPath, findPost } from "@/lib/blog";
import { learnPath } from "@/lib/learn";
import { filterLibrary, NO_LIBRARY_FILTER } from "@/lib/library";
import { JsonLd } from "@/components/JsonLd";
import { seoFor } from "@/i18n/metadata";
import { defaultLocale } from "@/lib/i18n/config";
import { localizedUrl } from "@/lib/seo";
import { blogPosting, breadcrumbList } from "@/lib/structured-data";

/** Official materials listed under an article, at most. */
const RELATED = 6;

export async function generateMetadata({
  params,
}: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const post = findPost((await params).slug);
  if (!post) return {};
  // Written in Traditional Chinese whatever the interface (D167).
  return seoFor({
    path: blogPath(post.slug),
    title: post.title,
    description: post.description,
    type: "article",
    publishedTime: post.published,
    contentLocale: "zh-Hant",
  });
}

const linkClassName =
  "text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink";

/** Article text in the site's type and colors; links inside the site stay in it. */
const components: Components = {
  h2: ({ children }) => (
    <h2 className="mt-10 font-display text-h2">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-6 font-display text-h3">{children}</h3>
  ),
  p: ({ children }) => <p className="mt-4">{children}</p>,
  ul: ({ children }) => (
    <ul className="mt-4 list-disc space-y-1 pl-6">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mt-4 list-decimal space-y-1 pl-6">{children}</ol>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mt-4 border-l-2 border-line pl-4 text-supporting text-ink-muted">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) =>
    href?.startsWith("/") ? (
      <Link href={href} className={linkClassName}>
        {children}
      </Link>
    ) : (
      <a href={href} className={linkClassName} rel="noopener">
        {children}
      </a>
    ),
  table: ({ children }) => (
    <div
      tabIndex={0}
      className="mt-4 overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <table className="w-full min-w-[28rem] border-y border-line text-supporting">
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-line px-2 py-2 text-left font-normal text-ink-muted">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-line px-2 py-2 align-top">{children}</td>
  ),
  em: ({ children }) => (
    <em lang="en" className="font-medium not-italic">
      {children}
    </em>
  ),
};

/**
 * One article (D122): its text, then official materials from its topics
 * and links to those topics' pages. Public; no sign-in.
 */
export default async function BlogPostPage({
  params,
}: PageProps<"/blog/[slug]">) {
  const post = findPost((await params).slug);
  if (!post) notFound();
  const [t, tCommon, tNames, format, source, all] = await Promise.all([
    getTranslations("blog"),
    getTranslations("common"),
    getTranslations("categories.names"),
    getFormatter(),
    readFile(join(process.cwd(), blogFile(post.slug)), "utf8"),
    getLibraryItems(),
  ]);
  const related = filterLibrary(all, {
    ...NO_LIBRARY_FILTER,
    categories: post.topics,
  }).slice(0, RELATED);

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <Link
        href="/blog"
        className="tap text-supporting text-ink-muted hover:text-ink"
      >
        <span aria-hidden="true">← </span>
        {t("back")}
      </Link>
      <article lang="zh-Hant" className="mt-6 max-w-reading">
        <h1 className="font-display text-h1">{post.title}</h1>
        <p className="mt-3 text-metadata text-ink-muted">
          <time dateTime={post.published}>
            {format.dateTime(new Date(`${post.published}T12:00:00Z`), {
              dateStyle: "long",
              timeZone: "UTC",
            })}
          </time>
        </p>
        <Markdown remarkPlugins={[remarkGfm]} components={components}>
          {source}
        </Markdown>
      </article>

      <section aria-labelledby="blog-related" className="mt-16">
        <h2 id="blog-related" className="font-display text-h2">
          {t("related")}
        </h2>
        {related.length === 0 ? (
          <p className="mt-4 text-ink-muted">{t("none")}</p>
        ) : (
          <ul className="mt-6 grid gap-4 split:grid-cols-2 wide:grid-cols-3">
            {related.map((item) => (
              <li key={item.id}>
                <MaterialCard item={item} />
              </li>
            ))}
          </ul>
        )}
        <div className="mt-8 flex flex-wrap gap-3">
          {post.topics.map((topic) => (
            <ButtonLink key={topic} href={learnPath(topic)} variant="secondary">
              {t("topic", { name: tNames(topic) })}
            </ButtonLink>
          ))}
          <ButtonLink href="/level-test" variant="ghost">
            {t("levelTest")}
          </ButtonLink>
        </div>
      </section>
      <JsonLd
        data={blogPosting({
          headline: post.title,
          description: post.description,
          url: localizedUrl(blogPath(post.slug), defaultLocale),
          published: post.published,
          publisher: tCommon("appName"),
        })}
      />
      <JsonLd
        data={breadcrumbList([
          { name: tCommon("appName"), url: localizedUrl("/", defaultLocale) },
          { name: t("title"), url: localizedUrl("/blog", defaultLocale) },
          {
            name: post.title,
            url: localizedUrl(blogPath(post.slug), defaultLocale),
          },
        ])}
      />
    </main>
  );
}
