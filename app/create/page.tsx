import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { getCreator } from "@/auth/creator";
import { getServerSupabase } from "@/auth/server";
import { CreatePracticeForm } from "@/components/CreatePracticeForm";
import { CollectionManager } from "@/components/CollectionManager";
import { PracticeAudioStatus } from "@/components/PracticeAudioStatus";
import { PracticeControls } from "@/components/PracticeControls";
import { parseVoiceId } from "@/lib/ai/types";
import { isTextSourceLanguage } from "@/lib/custom-practice/draft";
import { isVisibility } from "@/lib/custom-practice/organize";
import { customPracticeId } from "@/lib/practice-material";

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
  const [t, tOrganize, format, supabase] = await Promise.all([
    getTranslations("create"),
    getTranslations("organize"),
    getFormatter(),
    getServerSupabase(),
  ]);
  const [{ data: practices }, { data: collections }] = supabase
    ? await Promise.all([
        supabase
          .from("practices")
          .select(
            "id, title, source_language, voice, visibility, collection_id, created_at, practice_sentences(audio_path)",
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("collections")
          .select("id, title, visibility")
          .order("created_at", { ascending: true }),
      ])
    : [{ data: null }, { data: null }];
  const allPractices = practices ?? [];
  const allCollections = collections ?? [];
  const collectionChoices = allCollections.map(({ id, title }) => ({
    id,
    title,
  }));
  // Collections in creation order, then the ungrouped practices.
  const groups = [
    ...allCollections.map((collection) => ({
      key: collection.id,
      title: collection.title,
      practices: allPractices.filter((p) => p.collection_id === collection.id),
    })),
    {
      key: "ungrouped",
      title: t("ungrouped"),
      practices: allPractices.filter(
        (p) =>
          !p.collection_id ||
          !allCollections.some((c) => c.id === p.collection_id),
      ),
    },
  ].filter((group) => group.practices.length > 0);

  type PracticeRow = (typeof allPractices)[number];
  const row = (practice: PracticeRow) => {
    const sentences = practice.practice_sentences;
    const voice = practice.voice ? parseVoiceId(practice.voice) : null;
    return (
      <li key={practice.id} className="space-y-3 py-4">
        <div className="space-y-2">
          <p className="font-medium">{practice.title}</p>
          <p className="mt-1 text-supporting text-ink-muted">
            {t("listMeta", {
              count: sentences.length,
              language: t(
                `listLanguages.${isTextSourceLanguage(practice.source_language) ? practice.source_language : "en"}`,
              ),
              date: format.dateTime(new Date(practice.created_at), {
                dateStyle: "medium",
              }),
              voice: voice
                ? t("voiceName", {
                    accent: t(`accents.${voice.accent}`),
                    gender: t(`genders.${voice.gender}`),
                  })
                : "none",
            })}
          </p>
          {voice && (
            <PracticeAudioStatus
              practiceId={practice.id}
              practiceHref={`/videos/${customPracticeId(practice.id)}`}
              voiced={sentences.filter((s) => s.audio_path).length}
              total={sentences.length}
            />
          )}
        </div>
        <PracticeControls
          practice={{
            id: practice.id,
            title: practice.title,
            collectionId: practice.collection_id,
            visibility: isVisibility(practice.visibility)
              ? practice.visibility
              : "private",
          }}
          collections={collectionChoices}
        />
      </li>
    );
  };

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">{t("intro")}</p>
      <div className="mt-12 max-w-practice">
        <CreatePracticeForm />
      </div>
      <section className="mt-16 max-w-practice border-t border-line pt-8">
        <h2 className="font-display text-h2">{t("listTitle")}</h2>
        {groups.length > 0 ? (
          <>
            <p className="mt-2 text-supporting text-ink-muted">
              {tOrganize("visibilityNote")}
            </p>
            <div className="mt-6 space-y-10">
              {groups.map((group) => (
                <section key={group.key} aria-label={group.title}>
                  {allCollections.length > 0 && (
                    <h3 className="font-display text-h3">{group.title}</h3>
                  )}
                  <ul className="mt-4 divide-y divide-line border-y border-line">
                    {group.practices.map(row)}
                  </ul>
                </section>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-4 text-ink-muted">{t("listEmpty")}</p>
        )}
      </section>
      <section className="mt-16 max-w-practice border-t border-line pt-8">
        <h2 className="font-display text-h2">
          {tOrganize("collectionsTitle")}
        </h2>
        <div className="mt-4">
          <CollectionManager
            collections={allCollections.map((collection) => ({
              id: collection.id,
              title: collection.title,
              visibility: isVisibility(collection.visibility)
                ? collection.visibility
                : "private",
              practiceCount: allPractices.filter(
                (p) => p.collection_id === collection.id,
              ).length,
            }))}
          />
        </div>
      </section>
    </main>
  );
}
