import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CustomPromptForm } from "@/components/writing/CustomPrompts";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("writingCustom");
  return { title: t("newTitle"), robots: { index: false, follow: false } };
}

/** Write about your own topic, a diary, or anything (D196). */
export default async function NewWritingPromptPage() {
  const t = await getTranslations("writingCustom");
  return (
    <main className="mx-auto flex w-full max-w-content flex-1 flex-col gap-6 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("newTitle")}</h1>
      <p className="max-w-reading text-ink-muted">{t("newIntro")}</p>
      <CustomPromptForm />
    </main>
  );
}
