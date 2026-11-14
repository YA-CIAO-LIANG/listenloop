import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { ScrollRegion } from "@/components/ScrollRegion";
import {
  headingSlug,
  parseSystemDoc,
  parseSystemDocLanguage,
  SYSTEM_DOC_LANGUAGES,
  SYSTEM_DOCS,
} from "@/lib/system-docs";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.docs");
  return { title: t("title") };
}

/** The plain text of a heading's children, for its anchor. */
function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return `${node}`;
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (node && typeof node === "object" && "props" in node) {
    return textOf((node.props as { children?: ReactNode }).children);
  }
  return "";
}

const linkClassName =
  "text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink";

/**
 * The system documents (docs/system/), for admins only (the admin layout
 * answers 404 to everyone else): pick a document and a language. Rendered
 * on the server from the Markdown files, with the design system's type
 * and colors; diagrams show their Mermaid source, which GitHub draws.
 */
export default async function AdminDocsPage({
  searchParams,
}: PageProps<"/admin/docs">) {
  const query = await searchParams;
  const [t, locale] = await Promise.all([
    getTranslations("admin.docs"),
    getLocale(),
  ]);
  const doc = parseSystemDoc(query.doc);
  const language = parseSystemDocLanguage(query.lang, locale);
  const source = await readFile(
    // Literal folders (= systemDocPath) so the build traces only
    // docs/system into this function, not the whole project (D175).
    join(process.cwd(), "docs", "system", language, `${doc}.md`),
    "utf8",
  ).catch(() => null);
  const href = (d: string, l: string) => `/admin/docs?doc=${d}&lang=${l}`;

  const heading = (Tag: "h1" | "h2" | "h3" | "h4", className: string) =>
    function Heading({ children }: { children?: ReactNode }) {
      return (
        <Tag id={headingSlug(textOf(children))} className={className}>
          {children}
        </Tag>
      );
    };
  const components: Components = {
    h1: heading("h1", "font-display text-h1"),
    h2: heading("h2", "mt-12 border-t border-line pt-6 font-display text-h2"),
    h3: heading("h3", "mt-8 font-display text-h3"),
    h4: heading("h4", "mt-6 font-medium"),
    p: ({ children }) => <p className="mt-4 max-w-reading">{children}</p>,
    ul: ({ children }) => (
      <ul className="mt-4 max-w-reading list-disc space-y-1 pl-6">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="mt-4 max-w-reading list-decimal space-y-1 pl-6">
        {children}
      </ol>
    ),
    a: ({ href: to, children }) => (
      <a href={to} className={linkClassName}>
        {children}
      </a>
    ),
    hr: () => <hr className="mt-8 border-line" />,
    table: ({ children }) => (
      <div className="mt-4">
        <ScrollRegion label={t("table")}>
          <table className="w-full min-w-120 text-left text-supporting">
            {children}
          </table>
        </ScrollRegion>
      </div>
    ),
    th: ({ children }) => (
      <th scope="col" className="border-b border-line px-2 py-2 font-medium">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="border-b border-line px-2 py-2 align-top">{children}</td>
    ),
    // Scrolls sideways, so it takes focus and has a name (axe:
    // scrollable-region-focusable), like ScrollRegion.
    pre: ({ children }) => (
      <pre
        tabIndex={0}
        role="region"
        aria-label={t("code")}
        className="mt-4 overflow-x-auto rounded-base border border-line surface-card p-4 text-supporting focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {children}
      </pre>
    ),
    code: ({ className, children }) =>
      className === "language-mermaid" ? (
        <>
          <span className="mb-2 block text-ink-muted">{t("diagram")}</span>
          <code lang="en">{children}</code>
        </>
      ) : (
        <code className="rounded-base bg-surface px-1">{children}</code>
      ),
  };

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <p className="text-supporting text-ink-muted">{t("intro")}</p>
      <nav
        aria-label={t("choose")}
        className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3"
      >
        <ul className="flex flex-wrap gap-x-4 gap-y-2">
          {SYSTEM_DOCS.map((d) => (
            <li key={d}>
              <Link
                href={href(d, language)}
                aria-current={d === doc ? "page" : undefined}
                className={`tap inline-block border-b-2 ${
                  d === doc
                    ? "border-accent text-ink"
                    : "border-transparent text-ink-muted hover:text-ink"
                }`}
              >
                {t(`docs.${d}`)}
              </Link>
            </li>
          ))}
        </ul>
        <ul className="flex gap-x-4" aria-label={t("language")}>
          {SYSTEM_DOC_LANGUAGES.map((l) => (
            <li key={l}>
              <Link
                href={href(doc, l)}
                lang={l}
                aria-current={l === language ? "true" : undefined}
                className={`tap inline-block border-b-2 ${
                  l === language
                    ? "border-accent text-ink"
                    : "border-transparent text-ink-muted hover:text-ink"
                }`}
              >
                {t(`languages.${l}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <article lang={language} className="mt-10">
        {source === null ? (
          <p className="text-error">{t("missing")}</p>
        ) : (
          <Markdown remarkPlugins={[remarkGfm]} components={components}>
            {source}
          </Markdown>
        )}
      </article>
    </main>
  );
}
