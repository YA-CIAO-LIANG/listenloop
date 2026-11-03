import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { getCreator } from "@/auth/creator";
import { getServerSupabase } from "@/auth/server";
import { CreatePracticeForm } from "@/components/CreatePracticeForm";
import { isTextSourceLanguage } from "@/lib/custom-practice/draft";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("create");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * Creating practices from uploaded text (roadmap d). Admins only until
 * paid plans launch; everyone else gets a 404, as if it didn't exist.
 */
export default async function CreatePage() {
  const creator = await getCreator();
  if (!creator) notFound();
  const [t, format, supabase] = await Promise.all([
    getTranslations("create"),
    getFormatter(),
    getServerSupabase(),
  ]);
  const { data: practices } = (await supabase
    ?.from("practices")
    .select("id, title, source_language, created_at, practice_sentences(count)")
    .order("created_at", { ascending: false })) ?? { data: null };

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">{t("intro")}</p>
      <div className="mt-12 max-w-practice">
        <CreatePracticeForm />
      </div>
      <section className="mt-16 max-w-practice border-t border-line pt-8">
        <h2 className="font-display text-h2">{t("listTitle")}</h2>
        {practices && practices.length > 0 ? (
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {practices.map((practice) => (
              <li key={practice.id} className="py-4">
                <p className="font-medium">{practice.title}</p>
                <p className="mt-1 text-supporting text-ink-muted">
                  {t("listMeta", {
                    count: practice.practice_sentences[0]?.count ?? 0,
                    language: t(
                      `listLanguages.${isTextSourceLanguage(practice.source_language) ? practice.source_language : "en"}`,
                    ),
                    date: format.dateTime(new Date(practice.created_at), {
                      dateStyle: "medium",
                    }),
                  })}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-ink-muted">{t("listEmpty")}</p>
        )}
      </section>
    </main>
  );
}
