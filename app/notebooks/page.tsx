import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getAdminUser } from "@/auth/creator";
import { getServerSupabase } from "@/auth/server";
import { NewNotebookForm } from "@/components/NotebookControls";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("notebooks");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** The user's notebooks (D25). Admins only for now; 404 for others. */
export default async function NotebooksPage() {
  const user = await getAdminUser();
  const supabase = user && (await getServerSupabase());
  if (!supabase) notFound();
  const t = await getTranslations("notebooks");
  const { data: notebooks } = await supabase
    .from("notebooks")
    .select("id, title, notebook_entries(count)")
    .order("updated_at", { ascending: false });

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">{t("intro")}</p>
      <div className="mt-12 max-w-practice">
        <NewNotebookForm />
      </div>
      <section className="mt-12 max-w-practice">
        {notebooks && notebooks.length > 0 ? (
          <ul className="divide-y divide-line border-y border-line">
            {notebooks.map((notebook) => (
              <li key={notebook.id} className="py-4">
                <Link
                  href={`/notebooks/${notebook.id}`}
                  className="font-medium hover:text-accent-ink"
                >
                  {notebook.title}
                </Link>
                <p className="mt-1 text-supporting text-ink-muted">
                  {t("entryCount", {
                    count: notebook.notebook_entries[0]?.count ?? 0,
                  })}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-muted">{t("empty")}</p>
        )}
      </section>
    </main>
  );
}
