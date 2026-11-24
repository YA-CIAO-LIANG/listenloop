import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { WritingSettingsForm } from "@/components/writing/WritingSettingsForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("writingSettings");
  return { title: t("settingsTitle"), robots: { index: false } };
}

/**
 * Writing settings for everyone (D202): signed out they're kept in this
 * browser, signed in in the account too. The account page shows the
 * same form.
 */
export default async function WritingSettingsPage() {
  const t = await getTranslations("writingSettings");
  return (
    <main className="mx-auto flex w-full max-w-content flex-1 flex-col gap-6 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("settingsTitle")}</h1>
      <p className="max-w-reading text-ink-muted">{t("pageIntro")}</p>
      <div className="max-w-reading">
        <WritingSettingsForm />
      </div>
    </main>
  );
}
