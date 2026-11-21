import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { NotebookView } from "@/components/writing/NotebookView";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("writing.notebook");
  return { title: t("title"), robots: { index: false } };
}

/** My writing notebook (D187): spaced reviews of mistakes and patterns. */
export default async function NotebookPage() {
  const t = await getTranslations("writing.notebook");
  return (
    <main className="mx-auto flex w-full max-w-content flex-1 flex-col gap-6 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("title")}</h1>
      <p className="max-w-reading text-ink-muted">{t("intro")}</p>
      <NotebookView />
    </main>
  );
}
