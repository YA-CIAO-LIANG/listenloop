import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getAdminUser } from "@/auth/creator";
import { getServerSupabase } from "@/auth/server";
import {
  AddEntryForm,
  DeleteEntryButton,
  NotebookSettings,
} from "@/components/NotebookControls";
import { isUuid } from "@/lib/custom-practice/organize";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("notebooks");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** One notebook: its entries, adding new ones, renaming, deleting. */
export default async function NotebookPage({
  params,
}: PageProps<"/notebooks/[id]">) {
  const { id } = await params;
  const user = isUuid(id) ? await getAdminUser() : null;
  const supabase = user && (await getServerSupabase());
  if (!supabase) notFound();
  // Row level security: someone else's notebook reads as missing.
  const { data: notebook } = await supabase
    .from("notebooks")
    .select("id, title, notebook_entries(id, text, note, created_at)")
    .eq("id", id)
    .maybeSingle();
  if (!notebook) notFound();
  const t = await getTranslations("notebooks");
  const entries = [...notebook.notebook_entries].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <Link
        href="/notebooks"
        className="text-supporting text-ink-muted hover:text-ink"
      >
        <span aria-hidden="true">← </span>
        {t("title")}
      </Link>
      <h1 className="mt-6 font-display text-h1">{notebook.title}</h1>
      <div className="mt-4">
        <NotebookSettings
          notebook={{ id: notebook.id, title: notebook.title }}
        />
      </div>
      <section className="mt-12 max-w-practice">
        <h2 className="font-display text-h2">{t("addTitle")}</h2>
        <div className="mt-6">
          <AddEntryForm notebookId={notebook.id} />
        </div>
      </section>
      <section className="mt-16 max-w-practice border-t border-line pt-8">
        <h2 className="font-display text-h2">
          {t("entriesTitle", { count: entries.length })}
        </h2>
        {entries.length > 0 ? (
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-start gap-4 py-4">
                <div className="min-w-0 flex-1">
                  <p lang="en" className="text-sentence break-words">
                    {entry.text}
                  </p>
                  {entry.note && (
                    <p className="mt-1 text-supporting whitespace-pre-line text-ink-muted">
                      {entry.note}
                    </p>
                  )}
                </div>
                <DeleteEntryButton entry={{ id: entry.id, text: entry.text }} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-ink-muted">{t("noEntries")}</p>
        )}
      </section>
    </main>
  );
}
