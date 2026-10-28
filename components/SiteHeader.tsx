import Link from "next/link";
import { useTranslations } from "next-intl";
import { AQUARIUM_ENABLED } from "@/lib/features";
import { Divider } from "./Divider";
import { LanguageToggle } from "./LanguageToggle";
import { RewardBadge } from "./RewardBadge";
import { ThemeToggle } from "./ThemeToggle";

/** Wordmark on the left; rewards, language, and theme toggles on the right. */
export function SiteHeader() {
  const t = useTranslations("common");

  return (
    <header className="border-b border-line print:hidden">
      <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 split:px-6">
        <Link href="/" className="font-display text-h3">
          {t("appName")}
        </Link>
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
        </div>
      </div>
    </header>
  );
}
