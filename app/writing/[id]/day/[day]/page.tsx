import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getSignedInUser } from "@/auth/session";
import { getWritingPrompt } from "@/data/writing";
import { PromptTask } from "@/components/writing/PromptTask";
import { WritingDay } from "@/components/writing/WritingDay";
import type { CycleDay } from "@/lib/cycle";

export async function generateMetadata({
  params,
}: PageProps<"/writing/[id]/day/[day]">): Promise<Metadata> {
  const { id, day } = await params;
  const prompt = getWritingPrompt(id);
  const t = await getTranslations("writing");
  if (!prompt) return {};
  const locale = await getLocale();
  return {
    title: `${t("overview.dayN", { day: Number(day) })} · ${
      locale === "en" ? prompt.title.en : prompt.title.zh
    }`,
    robots: { index: false },
  };
}

/** One day of a prompt's week (D187). */
export default async function WritingDayPage({
  params,
}: PageProps<"/writing/[id]/day/[day]">) {
  const { id, day: rawDay } = await params;
  const prompt = getWritingPrompt(id);
  const day = Number(rawDay);
  if (!prompt || !Number.isInteger(day) || day < 1 || day > 7) notFound();
  const [t, locale, user] = await Promise.all([
    getTranslations("writing"),
    getLocale(),
    getSignedInUser(),
  ]);
  const title = locale === "en" ? prompt.title.en : prompt.title.zh;
  return (
    <main className="mx-auto flex w-full max-w-content flex-1 flex-col gap-6 px-4 py-10 split:px-6">
      <nav className="text-supporting">
        <Link href={`/writing/${prompt.id}`} className="underline">
          {title}
        </Link>
      </nav>
      <h1 className="font-display text-h1">
        {t("overview.dayN", { day })} ·{" "}
        {t(`overview.dayName.${day as CycleDay}`)}
      </h1>
      {(day === 1 || day === 7) && <PromptTask prompt={prompt} />}
      <WritingDay
        prompt={prompt}
        day={day as CycleDay}
        signedIn={user !== null}
        title={title}
      />
    </main>
  );
}
