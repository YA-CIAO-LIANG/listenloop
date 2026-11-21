import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { writingPrompts } from "@/data/writing";
import { WritingStats } from "@/components/writing/WritingStats";
import { statsMaterials } from "@/auth/stats-materials";
import { ProgressGate } from "@/components/ProgressGate";
import { StatsView } from "@/components/StatsView";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("stats");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** The learner's stats (D75): signed in only, like the progress page. */
export default async function StatsPage() {
  const [t, materials, locale] = await Promise.all([
    getTranslations("stats"),
    statsMaterials(),
    getLocale(),
  ]);
  const titles = Object.fromEntries(
    writingPrompts.map((p) => [
      p.id,
      locale === "en" ? p.title.en : p.title.zh,
    ]),
  );
  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">{t("intro")}</p>
      <ProgressGate place="practices" className="mt-8">
        <StatsView materials={materials} />
        {/* WritingLoop (D190): scores, criteria, mistakes, patterns. */}
        <div className="mt-12">
          <WritingStats titles={titles} />
        </div>
      </ProgressGate>
    </main>
  );
}
