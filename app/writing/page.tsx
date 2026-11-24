import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { writingPrompts } from "@/data/writing";
import { ButtonLink } from "@/components/ButtonLink";
import { WritingLibrary } from "@/components/writing/WritingLibrary";
import { WritingCalendar } from "@/components/writing/WritingCalendar";
import { WritingTasks } from "@/components/writing/WritingTasks";
import { CustomPromptList } from "@/components/writing/CustomPrompts";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("writing");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: "/writing" },
  };
}

/**
 * WritingLoop's home (D187): today's writing, then every prompt with
 * the library's filters.
 */
export default async function WritingPage() {
  const [t, tSettings, tChat, locale] = await Promise.all([
    getTranslations("writing"),
    getTranslations("writingSettings"),
    getTranslations("writingChat"),
    getLocale(),
  ]);
  const prompts = writingPrompts.map(
    ({ id, type, level, title, subtitle, words, minutes }) => ({
      id,
      type,
      level,
      title,
      subtitle,
      words,
      minutes,
    }),
  );
  const titles = Object.fromEntries(
    writingPrompts.map((p) => [
      p.id,
      locale === "en" ? p.title.en : p.title.zh,
    ]),
  );
  return (
    <main className="mx-auto flex w-full max-w-content flex-1 flex-col gap-10 px-4 py-12 split:px-6">
      <header className="flex flex-col gap-4">
        <h1 className="font-display text-h1">{t("title")}</h1>
        <p className="max-w-reading text-ink-muted">{t("intro")}</p>
        <ol className="grid max-w-reading gap-2 text-supporting split:grid-cols-3">
          <li>{t("steps.day1")}</li>
          <li>{t("steps.middle")}</li>
          <li>{t("steps.day7")}</li>
        </ol>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/writing/chat" variant="primary" size="sm">
            {tChat("title")}
          </ButtonLink>
          <ButtonLink href="/writing/notebook" variant="secondary" size="sm">
            {t("notebook.title")}
          </ButtonLink>
          <ButtonLink href="/writing/settings" variant="ghost" size="sm">
            {tSettings("settingsTitle")}
          </ButtonLink>
        </div>
      </header>
      <WritingTasks titles={titles} />
      {/* Its own calendar (D201): the home page's shows both. */}
      <WritingCalendar titles={titles} />
      <CustomPromptList />
      <Suspense fallback={null}>
        <WritingLibrary prompts={prompts} />
      </Suspense>
    </main>
  );
}
