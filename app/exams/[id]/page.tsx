import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getLibraryItems } from "@/auth/library";
import { MaterialCard } from "@/components/MaterialCard";
import { examGuides, getExamGuide } from "@/data/exams";
import { writingPrompts } from "@/data/writing";
import { seoFor } from "@/i18n/metadata";
import { pick } from "@/lib/exam-guides";
import {
  guideTracks,
  inListeningTrack,
  inWritingTrack,
  isExamGuide,
  type ExamTrackId,
} from "@/lib/exam-tracks";

export function generateStaticParams() {
  return examGuides.map((guide) => ({ id: guide.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/exams/[id]">): Promise<Metadata> {
  const { id } = await params;
  const guide = isExamGuide(id) ? getExamGuide(id) : undefined;
  if (!guide) return {};
  const [t, locale] = await Promise.all([
    getTranslations("exams"),
    getLocale(),
  ]);
  return seoFor({
    path: `/exams/${id}`,
    title: t("pageTitle", { name: pick(guide.name, locale) }),
    description: pick(guide.summary, locale),
  });
}

/**
 * One exam's guide (D215): the test, its parts, scoring, how to practise,
 * then this site's listening materials and writing prompts for it (GEPT
 * by level), and the exam owner's free official practice, linked only.
 */
export default async function ExamGuidePage({
  params,
}: PageProps<"/exams/[id]">) {
  const { id } = await params;
  const guide = isExamGuide(id) ? getExamGuide(id) : undefined;
  if (!guide) notFound();
  const [t, tTracks, locale, items] = await Promise.all([
    getTranslations("exams"),
    getTranslations("examTracks"),
    getLocale(),
    getLibraryItems(),
  ]);
  const tracks = guideTracks(guide.id);
  const byTrack = tracks.length > 1;
  const date = (iso: string) =>
    new Intl.DateTimeFormat(locale === "en" ? "en" : "zh-TW", {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(new Date(`${iso}T00:00:00Z`));

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <Link
        href="/exams"
        className="tap text-supporting text-ink-muted hover:text-ink"
      >
        <span aria-hidden="true">← </span>
        {t("back")}
      </Link>
      <h1 className="mt-6 font-display text-h1">{pick(guide.name, locale)}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">
        {pick(guide.summary, locale)}
      </p>

      {guide.sections.map((section) => (
        <section
          key={section.id}
          aria-labelledby={`exam-${section.id}`}
          className="mt-10 max-w-reading"
        >
          <h2 id={`exam-${section.id}`} className="font-display text-h2">
            {pick(section.heading, locale)}
          </h2>
          {(locale === "en"
            ? section.paragraphs.en
            : section.paragraphs.zh
          ).map((paragraph) => (
            <p key={paragraph} className="mt-3">
              {paragraph}
            </p>
          ))}
        </section>
      ))}

      <section aria-labelledby="exam-materials" className="mt-12">
        <h2 id="exam-materials" className="font-display text-h2">
          {t("materials")}
        </h2>
        {tracks.map((track) => {
          const listening = items.filter((item) =>
            inListeningTrack(item, track),
          );
          const prompts = writingPrompts.filter((prompt) =>
            inWritingTrack(prompt, track),
          );
          return (
            <div key={track.id} className="mt-6 space-y-4">
              {byTrack && (
                <h3 className="font-display text-h3">
                  {tTracks(track.id as ExamTrackId)}
                </h3>
              )}
              {track.listening && (
                <div className="space-y-3">
                  <p className="font-medium">
                    {t("listening", { count: listening.length })}
                  </p>
                  {listening.length === 0 ? (
                    <p className="text-ink-muted">{t("noListening")}</p>
                  ) : (
                    <ul className="grid gap-6 split:grid-cols-2">
                      {listening.map((item) => (
                        <li key={item.id}>
                          <MaterialCard item={item} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {track.writing && (
                <div className="space-y-3">
                  <p className="font-medium">
                    {t("writing", { count: prompts.length })}
                  </p>
                  {prompts.length === 0 ? (
                    <p className="text-ink-muted">{t("noWriting")}</p>
                  ) : (
                    <ul className="grid gap-2 split:grid-cols-2">
                      {prompts.map((prompt) => (
                        <li key={prompt.id}>
                          <Link
                            href={`/writing/${prompt.id}`}
                            className="tap text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink"
                          >
                            {locale === "en"
                              ? prompt.title.en
                              : prompt.title.zh}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </section>

      <section aria-labelledby="exam-resources" className="mt-12 max-w-reading">
        <h2 id="exam-resources" className="font-display text-h2">
          {t("resources")}
        </h2>
        <p className="mt-2 text-supporting text-ink-muted">
          {t("resourcesNote")}
        </p>
        <ul className="mt-4 space-y-3">
          {guide.resources.map((resource) => (
            <li key={resource.url}>
              <a
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink"
              >
                {pick(resource.title, locale)}
              </a>
              <span className="block text-supporting text-ink-muted">
                {t("resourceMeta", {
                  publisher: resource.publisher,
                  date: date(resource.checkedAt),
                })}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
