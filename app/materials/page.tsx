import type { Metadata } from "next";
import { practiceTitles } from "@/lib/titles";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { getAdminSupabase } from "@/auth/admin";
import { getCreator } from "@/auth/creator";
import { getServerSupabase } from "@/auth/server";
import { getSignedInUser } from "@/auth/session";
import { CollectionManager } from "@/components/CollectionManager";
import { MaterialsBrowser } from "@/components/MaterialsBrowser";
import { PracticeReadiness } from "@/components/PracticeReadiness";
import { OfficialToggle } from "@/components/OfficialToggle";
import { PracticeControls } from "@/components/PracticeControls";
import { parseVoiceId } from "@/lib/ai/types";
import { isTextSourceLanguage } from "@/lib/custom-practice/draft";
import { isVisibility } from "@/lib/custom-practice/organize";
import { isReportReason } from "@/lib/moderation";
import { customPracticeId } from "@/lib/practice-material";

/**
 * The server actions on this page call the AI providers: up to 60 s
 * (Vercel Hobby's limit), longer than any provider timeout, so a slow call
 * ends in a logged timeout, never a cut-off function (D49).
 */
export const maxDuration = 60;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("materials");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * "My materials" (D26, D48, D147): the practices the user created, as
 * folders (their collections and the categories). For everyone signed
 * in (D72 opened creating to every plan); admins also get the links to
 * reports and usage, and the official switch. Signed out: 404. Creating
 * needs the providers too.
 */
export default async function MaterialsPage({
  searchParams,
}: PageProps<"/materials">) {
  // Inside a folder (D147), its own rename and delete are on the page.
  const inFolder = Boolean((await searchParams).folder);
  const [user, creator] = await Promise.all([getSignedInUser(), getCreator()]);
  if (!user) notFound();
  const [t, tMaterials, tOrganize, tReasons, format, supabase] =
    await Promise.all([
      getTranslations("create"),
      getTranslations("materials"),
      getTranslations("organize"),
      getTranslations("report.reasons"),
      getFormatter(),
      getServerSupabase(),
    ]);
  const admin = user.role === "admin";
  // Open reports to review (D31), counted with the secret key.
  const openReports = !admin
    ? 0
    : ((
        await getAdminSupabase()
          ?.from("practice_reports")
          .select("id", { count: "exact", head: true })
          .eq("status", "open")
      )?.count ?? 0);
  const [{ data: practices }, { data: collections }] = supabase
    ? await Promise.all([
        supabase
          .from("practices")
          .select(
            "id, title, title_en, title_zh, subtitle, source_language, voice, visibility, official, collection_id, category, estimated_seconds, duration_sec, created_at, notes_generated_at, removed_at, removed_reason, youtube_id, youtube_license, source_audio_path, rights_confirmed_at, practice_sentences(audio_path)",
          )
          // Others' public practices are readable too (D30); list only theirs,
          // and not official materials, which live on /admin/official (D80).
          .eq("user_id", user.id)
          .eq("official", false)
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
  type PracticeRow = (typeof allPractices)[number];
  // What "Manage" opens under each material (D147).
  const details = (practice: PracticeRow) => {
    const sentences = practice.practice_sentences;
    const voice = practice.voice ? parseVoiceId(practice.voice) : null;
    return (
      <div className="space-y-3">
        <div className="space-y-2">
          <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            {/* A YouTube practice's sentences follow the video (D97), a
                recording's follow the recording (D130). */}
            {creator && !practice.youtube_id && !practice.source_audio_path && (
              <Link
                href={`/materials/${practice.id}/edit`}
                className="text-supporting text-accent-ink underline underline-offset-4"
                aria-label={tMaterials("editLabel", { title: practice.title })}
              >
                {tMaterials("edit")}
              </Link>
            )}
          </p>
          <p className="mt-1 text-supporting text-ink-muted">
            {t("listMeta", {
              count: sentences.length,
              language: t(
                `listLanguages.${isTextSourceLanguage(practice.source_language) ? practice.source_language : "en"}`,
              ),
              date: Number.isNaN(Date.parse(practice.created_at))
                ? ""
                : format.dateTime(new Date(practice.created_at), {
                    dateStyle: "medium",
                  }),
              voice: practice.source_audio_path
                ? t("ownRecording")
                : voice
                  ? t("voiceName", {
                      accent: t(`accents.${voice.accent}`),
                      gender: t(`genders.${voice.gender}`),
                    })
                  : "none",
            })}
          </p>
          {(voice || practice.youtube_id || practice.source_audio_path) && (
            <PracticeReadiness
              practiceId={practice.id}
              practiceHref={`/videos/${customPracticeId(practice.id)}`}
              notesReady={practice.notes_generated_at !== null}
              voiced={
                practice.youtube_id || practice.source_audio_path
                  ? sentences.length
                  : sentences.filter((s) => s.audio_path).length
              }
              total={sentences.length}
            />
          )}
        </div>
        {practice.removed_at && (
          <p className="text-supporting text-error">
            {tMaterials("removed", {
              reason: isReportReason(practice.removed_reason)
                ? tReasons(practice.removed_reason)
                : tReasons("other"),
            })}
          </p>
        )}
        {!practice.removed_at && admin && (
          <OfficialToggle
            practice={{ id: practice.id, title: practice.title }}
          />
        )}
        <PracticeControls
          practice={{
            id: practice.id,
            title: practice.title,
            removed: practice.removed_at !== null,
            official: practice.official,
            privateOnly: practice.youtube_license === "youtube",
            needsRights:
              !!practice.source_audio_path && !practice.rights_confirmed_at,
            collectionId: practice.collection_id,
            visibility: isVisibility(practice.visibility)
              ? practice.visibility
              : "private",
          }}
          collections={collectionChoices}
          hideCollection
        />
      </div>
    );
  };

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{tMaterials("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">{tMaterials("intro")}</p>
      {admin && (
        <p className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
          <Link
            href="/admin/reports"
            className="text-supporting text-accent-ink underline underline-offset-4"
          >
            {tMaterials("reviewReports", { count: openReports })}
          </Link>
          <Link
            href="/admin/usage"
            className="text-supporting text-accent-ink underline underline-offset-4"
          >
            {tMaterials("usageLink")}
          </Link>
        </p>
      )}
      {!creator && (
        <p className="mt-6 text-supporting text-ink-muted">
          {tMaterials("createUnavailable")}
        </p>
      )}
      <div className="mt-8 max-w-content">
        <MaterialsBrowser
          canCreate={creator !== null}
          folders={collectionChoices}
          materials={allPractices.map((practice) => ({
            id: practice.id,
            videoId: customPracticeId(practice.id),
            titles: {
              en: practiceTitles(practice).en,
              zh: practiceTitles(practice).zh,
            },
            subtitle: practice.subtitle,
            seconds: practice.duration_sec ?? practice.estimated_seconds,
            collectionId: practice.collection_id,
            category: practice.category,
            details: details(practice),
          }))}
        />
      </div>
      {allPractices.length > 0 && (
        <p className="mt-6 max-w-reading text-supporting text-ink-muted">
          {tOrganize("visibilityNote")}
        </p>
      )}
      {allCollections.length > 0 && !inFolder && (
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
      )}
    </main>
  );
}
