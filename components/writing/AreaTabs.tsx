"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * "Listening | Writing" in the header (D187): which half of the site the
 * page belongs to. WritingLoop lives under /writing; everything else is
 * ListenLoop. Links with aria-current, not tabs: each is its own page.
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
  const item = (href: string, text: string, current: boolean) => (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`inline-flex min-h-8 items-center px-3 text-supporting transition-colors duration-(--ll-duration-transition) pointer-coarse:min-h-11 ${
        current
          ? "bg-ink text-ground"
          : "text-ink-muted hover:bg-ink/6 hover:text-ink"
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
      {item("/writing", writing, inWriting)}
    </nav>
  );
}
