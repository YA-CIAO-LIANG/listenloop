import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { examGuides } from "@/data/exams";
import { seoFor } from "@/i18n/metadata";
import { pick } from "@/lib/exam-guides";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("exams");
  return seoFor({
    path: "/exams",
    title: t("indexTitle"),
    description: t("indexIntro"),
  });
}

/**
 * "Exam English" (D215): every exam's guide, with its materials and
 * free official practice. Public; no sign-in.
 */
export default async function ExamsPage() {
  const [t, locale] = await Promise.all([
    getTranslations("exams"),
    getLocale(),
  ]);
  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("indexTitle")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">{t("indexIntro")}</p>
      <ul className="mt-10 grid gap-6 split:grid-cols-2">
        {examGuides.map((guide) => (
          <li
            key={guide.id}
            className="rounded-base border border-line surface-card p-5"
          >
            <h2 className="font-display text-h3">
              <Link
                href={`/exams/${guide.id}`}
                className="tap text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink"
              >
                {pick(guide.name, locale)}
              </Link>
            </h2>
            <p className="mt-2 text-supporting text-ink-muted">
              {pick(guide.summary, locale)}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
