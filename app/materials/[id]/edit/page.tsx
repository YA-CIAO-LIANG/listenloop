import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCreator } from "@/auth/creator";
import { getServerSupabase } from "@/auth/server";
import { EditPracticeForm } from "@/components/EditPracticeForm";
import { DEFAULT_VOICE } from "@/lib/custom-practice/draft";
import { isUuid } from "@/lib/custom-practice/organize";
import { parseSentenceNotes } from "@/lib/custom-practice/notes";

/**
 * The server actions on this page call the AI providers: up to 60 s
 * (Vercel Hobby's limit), longer than any provider timeout, so a slow call
 * ends in a logged timeout, never a cut-off function (D49).
 */
export const maxDuration = 60;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("editPractice");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * Editing one of the user's practices (e+ 9c, D45). Only its author, and
 * only while creating is open to them (admins until paid plans), since
 * saving can make new audio and notes; 404 for everyone else.
 */
export default async function EditPracticePage({
  params,
}: PageProps<"/materials/[id]/edit">) {
  const { id } = await params;
  const creator = await getCreator();
  const supabase = creator && (await getServerSupabase());
  if (!creator || !supabase || !isUuid(id)) notFound();
  const { data: practice } = await supabase
    .from("practices")
    .select("id, title, voice, version, practice_sentences(i, en, zh, notes)")
    .eq("id", id)
    .eq("user_id", creator.user.id)
    .maybeSingle();
  if (!practice) notFound();
  const [t, tMaterials] = await Promise.all([
    getTranslations("editPractice"),
    getTranslations("materials"),
  ]);
  const sentences = [...practice.practice_sentences]
    .sort((a, b) => a.i - b.i)
    .map((s) => ({ en: s.en, zh: s.zh, notes: parseSentenceNotes(s.notes) }));

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
      <div className="mt-8 max-w-practice">
        <EditPracticeForm
          practice={{
            id: practice.id,
            title: practice.title,
            voice: practice.voice ?? DEFAULT_VOICE,
            version: practice.version,
            sentences,
          }}
        />
      </div>
    </main>
  );
}
