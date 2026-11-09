import Link from "next/link";
import { useTranslations } from "next-intl";
import { ThemeToggle } from "./ThemeToggle";

const linkClassName = "tap underline-offset-4 hover:text-ink hover:underline";

/**
 * Bottom of every page (D60): terms, privacy policy, credits, and
 * feedback; public for Google sign-in's and Google Play's review.
 */
export function SiteFooter() {
  const t = useTranslations("footer");

  return (
    <footer className="mt-16 border-t border-line print:hidden">
      <nav
        aria-label={t("label")}
        className="mx-auto flex max-w-content flex-wrap gap-x-6 gap-y-2 px-4 py-6 text-supporting text-ink-muted split:px-6"
      >
        <Link href="/learn" className={linkClassName}>
          {t("learn")}
        </Link>
        <Link href="/pricing" className={linkClassName}>
          {t("pricing")}
        </Link>
        <Link href="/terms" className={linkClassName}>
          {t("terms")}
        </Link>
        <Link href="/refund" className={linkClassName}>
          {t("refund")}
        </Link>
        <Link href="/privacy" className={linkClassName}>
          {t("privacy")}
        </Link>
        <Link href="/credits" className={linkClassName}>
          {t("credits")}
        </Link>
        <Link href="/feedback" className={linkClassName}>
          {t("feedback")}
        </Link>
      </nav>
      {/* Phones only: the header has no room for it (D86). */}
      <div className="mx-auto max-w-content px-4 pb-6 split:hidden">
        <ThemeToggle />
      </div>
    </footer>
  );
}
