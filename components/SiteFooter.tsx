import Link from "next/link";
import { useTranslations } from "next-intl";

const linkClassName = "underline-offset-4 hover:text-ink hover:underline";

/** Bottom of every page: the privacy policy and the credits. */
export function SiteFooter() {
  const t = useTranslations("footer");

  return (
    <footer className="mt-16 border-t border-line print:hidden">
      <nav
        aria-label={t("label")}
        className="mx-auto flex max-w-content flex-wrap gap-x-6 gap-y-2 px-4 py-6 text-supporting text-ink-muted split:px-6"
      >
        <Link href="/privacy" className={linkClassName}>
          {t("privacy")}
        </Link>
        <Link href="/credits" className={linkClassName}>
          {t("credits")}
        </Link>
      </nav>
    </footer>
  );
}
