import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { FeedbackForm } from "@/components/FeedbackForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("feedback");
  return { title: t("title"), description: t("intro") };
}

/** Feedback (D60), linked from every page's footer. */
export default async function FeedbackPage() {
  const t = await getTranslations("feedback");
  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">{t("intro")}</p>
      <div className="mt-8 max-w-reading">
        <Suspense fallback={null}>
          <FeedbackForm />
        </Suspense>
      </div>
    </main>
  );
}
