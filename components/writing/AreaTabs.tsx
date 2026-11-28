"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * "Listening | Writing" in the header (D187): which half of the site the
 * page belongs to. WritingLoop lives under /writing; everything else is
 * ListenLoop. Links with aria-current, not tabs: each is its own page.
 * The current one wears its area's color (D217): listening the site's
 * accent (orange by default), writing teal; the other stays plain, so the
 * color and the filled background both say where the learner is.
 */
export function AreaTabs({
  listening,
  writing,
  label,
}: {
  listening: string;
  writing: string;
  label: string;
}) {
  const pathname = usePathname() ?? "/";
  const inWriting = pathname === "/writing" || pathname.startsWith("/writing/");
  const item = (
    href: string,
    text: string,
    current: boolean,
    area?: "writing",
  ) => (
    <Link
      href={href}
      data-area={area}
      aria-current={current ? "page" : undefined}
      className={`inline-flex min-h-8 items-center px-3 text-supporting transition-colors duration-(--ll-duration-transition) pointer-coarse:min-h-11 ${
        current
          ? "border-b-2 border-accent bg-accent/14 font-medium text-accent-ink"
          : "border-b-2 border-transparent text-ink-muted hover:bg-ink/6 hover:text-ink"
      }`}
    >
      {text}
    </Link>
  );
  return (
    <nav
      aria-label={label}
      className="inline-flex overflow-hidden rounded-base border border-line"
    >
      {item("/", listening, !inWriting)}
      {item("/writing", writing, inWriting, "writing")}
    </nav>
  );
}
