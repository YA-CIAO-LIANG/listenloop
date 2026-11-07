"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ADMIN_SECTIONS } from "@/lib/admin-dashboard";

/**
 * The admin dashboard's sections (D56): a row of links that scrolls
 * sideways on a phone instead of wrapping into many lines. The current
 * section is marked with aria-current and an accent underline.
 */
export function AdminNav() {
  const t = useTranslations("admin.nav");
  const pathname = usePathname();
  const current = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
  return (
    <nav aria-label={t("label")} className="border-b border-line">
      <ul className="-mb-px flex gap-x-6 overflow-x-auto whitespace-nowrap">
        {ADMIN_SECTIONS.map(({ id, href }) => (
          <li key={id}>
            <Link
              href={href}
              aria-current={current(href) ? "page" : undefined}
              className={`inline-block border-b-2 py-3 text-supporting ${
                current(href)
                  ? "border-accent text-ink"
                  : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              {t(id)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
