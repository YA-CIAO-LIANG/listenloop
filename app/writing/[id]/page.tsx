import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getWritingPrompt, writingPrompts } from "@/data/writing";
import { Tag } from "@/components/Tag";
import { PromptTask } from "@/components/writing/PromptTask";
import { WritingOverview } from "@/components/writing/WritingOverview";
import { CustomPromptOverview } from "@/components/writing/CustomPrompts";
import { isCustomPromptId } from "@/lib/writing/custom";

export function generateStaticParams() {
  return writingPrompts.map((p) => ({ id: p.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/writing/[id]">): Promise<Metadata> {
  const { id } = await params;
  // A learner's own prompt (D196): private, never indexed.
  if (isCustomPromptId(id)) {
    const t = await getTranslations("writingCustom");
    return { title: t("metaTitle"), robots: { index: false, follow: false } };
  }
  const prompt = getWritingPrompt(id);
  if (!prompt) return {};
  const locale = await getLocale();
  return {
    title: locale === "en" ? prompt.title.en : prompt.title.zh,
    description: prompt.subtitle,
    alternates: { canonical: `/writing/${prompt.id}` },
  };
}

/** One prompt (D187): the task, then its week. The model stays hidden. */
export default async function WritingPromptPage({
  params,
}: PageProps<"/writing/[id]">) {
  const { id } = await params;
  if (isCustomPromptId(id)) {
    // Only this browser (and the account) has it: read there.
    return (
      <main className="mx-auto flex w-full max-w-content flex-1 flex-col gap-8 px-4 py-12 split:px-6">
        <CustomPromptOverview id={id} />
      </main>
    );
  }
  const prompt = getWritingPrompt(id);
  if (!prompt) notFound();
  const [t, locale] = await Promise.all([
    getTranslations("writing"),
    getLocale(),
  ]);
  return (
    <main className="mx-auto flex w-full max-w-content flex-1 flex-col gap-8 px-4 py-12 split:px-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Tag>{t(`types.${prompt.type}`)}</Tag>
          <Tag>{t(`levels.${prompt.level}`)}</Tag>
        </div>
        <h1 className="font-display text-h1">
          <span lang="en">{prompt.title.en}</span>
          {locale !== "en" && (
            <span className="block text-h3 text-ink-muted">
              {prompt.title.zh}
            </span>
          )}
        </h1>
        <p className="text-ink-muted">{prompt.subtitle}</p>
      </header>
      <PromptTask prompt={prompt} />
      <WritingOverview promptId={prompt.id} />
    </main>
  );
}
