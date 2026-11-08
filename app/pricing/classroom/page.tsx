import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ClassPricing } from "@/components/ClassPricing";
import { isIntentSource } from "@/lib/intent";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("classPricing");
  return { title: t("title"), description: t("intro") };
}

/** Class plans for teachers (D103): a fake door for now. */
export default async function ClassPricingPage({
  searchParams,
}: PageProps<"/pricing/classroom">) {
  const [t, params] = await Promise.all([
    getTranslations("classPricing"),
    searchParams,
  ]);
  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">{t("intro")}</p>
      <div className="mt-8">
        <ClassPricing
          source={isIntentSource(params.from) ? params.from : "classroom"}
        />
      </div>
    </main>
  );
}
