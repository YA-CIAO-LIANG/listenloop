import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCreator } from "@/auth/creator";
import { CreatePracticeForm } from "@/components/CreatePracticeForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("create");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * Creating a practice from uploaded text (roadmap d). Admins only until
 * paid plans launch, and only with a provider; 404 for everyone else.
 */
export default async function NewMaterialPage() {
  if (!(await getCreator())) notFound();
  const [t, tMaterials] = await Promise.all([
    getTranslations("create"),
    getTranslations("materials"),
  ]);

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <Link
        href="/materials"
        className="text-supporting text-ink-muted hover:text-ink"
      >
        <span aria-hidden="true">← </span>
        {tMaterials("title")}
      </Link>
      <h1 className="mt-6 font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">{t("intro")}</p>
      <div className="mt-12 max-w-practice">
        <CreatePracticeForm />
      </div>
    </main>
  );
}
