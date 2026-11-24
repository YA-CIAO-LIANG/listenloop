import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BedtimeReview } from "@/components/writing/BedtimeReview";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("writing.bedtime");
  return { title: t("title"), robots: { index: false } };
}

/** The evening review (D203): three of today's sentences from memory. */
export default async function BedtimeReviewPage() {
  const t = await getTranslations("writing.bedtime");
  return (
    <main className="mx-auto flex w-full max-w-content flex-1 flex-col gap-6 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("title")}</h1>
      <p className="max-w-reading text-ink-muted">{t("intro")}</p>
      <BedtimeReview />
    </main>
  );
}
