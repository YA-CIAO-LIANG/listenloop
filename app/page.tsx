import { useTranslations } from "next-intl";

// TODO(M1): use core components once they land (PR 3).
export default function Home() {
  const t = useTranslations();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="font-display text-h1">{t("common.appName")}</h1>
      <p className="font-display text-h3">{t("home.tagline")}</p>
      <p className="text-supporting text-ink-muted">{t("home.comingSoon")}</p>
    </main>
  );
}
