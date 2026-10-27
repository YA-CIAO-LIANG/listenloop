import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ShopView } from "@/components/ShopView";
import { fishCatalog } from "@/data/fish";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("shop");
  return { title: t("title") };
}

export default async function ShopPage() {
  const t = await getTranslations("shop");

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">{t("intro")}</p>
      <div className="mt-12">
        <ShopView catalog={fishCatalog} />
      </div>
      <p className="mt-16 border-t border-line pt-6 text-supporting">
        <Link
          href="/credits"
          className="text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink"
        >
          {t("credits")}
        </Link>
      </p>
    </main>
  );
}
