import Link from "next/link";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { AQUARIUM_ENABLED } from "@/lib/features";
import { Divider } from "./Divider";
import { LanguageToggle } from "./LanguageToggle";
import { RewardBadge } from "./RewardBadge";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Wordmark and "My practices" on the left; rewards, language, and theme toggles on the right,
 * then the account control when accounts are on (passed in by the layout,
 * which reads the session on the server).
 */
export function SiteHeader({ account }: { account?: ReactNode }) {
  const t = useTranslations("common");

  return (
    <header className="border-b border-line print:hidden">
      <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 split:px-6">
        <nav aria-label={t("mainNav")} className="flex items-baseline gap-x-6">
          <Link href="/" className="font-display text-h3">
            {t("appName")}
          </Link>
          <Link
            href="/practices"
            className="text-supporting text-ink-muted underline-offset-4 hover:text-ink hover:underline"
          >
            {t("myPractices")}
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          {AQUARIUM_ENABLED && (
            <>
              <RewardBadge />
              <Divider orientation="vertical" className="my-2" />
            </>
          )}
          <LanguageToggle />
          <Divider orientation="vertical" className="my-2" />
          <ThemeToggle />
          {account && (
            <>
              <Divider orientation="vertical" className="my-2" />
              {account}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
