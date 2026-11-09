import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MisheardReview } from "@/components/MisheardReview";
import { ProgressGate } from "@/components/ProgressGate";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("review");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * "My misheard words" (D108): today's spaced review and the whole list.
 * Like progress, it shows when signed in (D2).
 */
export default async function ReviewPage() {
  const t = await getTranslations("review");
  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">{t("intro")}</p>
      <ProgressGate place="practices" className="mt-8">
        <MisheardReview />
      </ProgressGate>
    </main>
  );
}
