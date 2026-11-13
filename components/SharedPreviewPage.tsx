import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { VideoPlayerPanel } from "@/app/videos/[id]/VideoPlayerPanel";
import { minutesAndSeconds } from "@/lib/excerpt-length";
import type { SharedPreview } from "@/lib/practice-material";
import { MaterialTitle } from "./MaterialTitle";
import { PreviewActions } from "./PreviewActions";
import { Tag } from "./Tag";
import { VideoAttribution } from "./VideoAttribution";

/**
 * A shared practice for those who may not practice it (D106): free
 * accounts and signed-out visitors see its details, the first sentences
 * in English and Chinese, and can listen to the first one; the rest, the
 * notes, and the handout open with a paid plan.
 */
export async function SharedPreviewPage({
  preview,
}: {
  preview: SharedPreview;
}) {
  const t = await getTranslations("sharedPreview");
  const tAll = await getTranslations();

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <Link
        href="/explore"
        className="tap text-supporting text-ink-muted hover:text-ink"
      >
        <span aria-hidden="true">← </span>
        {tAll("video.backToExplore")}
      </Link>

      <p className="mt-8 text-metadata tracking-widest text-ink-muted uppercase">
        {t("label")}
      </p>
      <MaterialTitle
        as="h1"
        titles={{ en: preview.title, zh: preview.titleZh }}
        className="mt-2 font-display text-h1"
        zhClassName="mt-2 block font-display text-h2 text-ink-muted"
      />
      {preview.subtitle && (
        <p lang="zh-Hant" className="mt-3 max-w-reading text-ink-muted">
          {preview.subtitle}
        </p>
      )}
      <p className="mt-4 flex flex-wrap gap-2">
        {preview.category && (
          <Tag>{tAll(`categories.names.${preview.category}`)}</Tag>
        )}
        {preview.level && <Tag>{tAll(`video.levels.${preview.level}`)}</Tag>}
      </p>
      <p className="mt-3 text-supporting text-ink-muted">
        {[
          preview.durationSec !== null &&
            tAll("library.card.length", minutesAndSeconds(preview.durationSec)),
          preview.accent && tAll(`voicePicker.accents.${preview.accent}`),
          t("sentenceCount", { count: preview.sentenceCount }),
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>

      {preview.youtubeId && (
        <div className="mt-8">
          <VideoPlayerPanel youtubeId={preview.youtubeId} />
        </div>
      )}

      <section aria-labelledby="preview-sentences" className="mt-10">
        <h2 id="preview-sentences" className="font-display text-h3">
          {t("sentencesTitle", {
            shown: preview.sentences.length,
            count: preview.sentenceCount,
          })}
        </h2>
        <ol className="mt-4 max-w-reading space-y-4">
          {preview.sentences.map((sentence, i) => (
            <li key={i} className="border-b border-line pb-4">
              <p lang="en" className="text-body">
                {sentence.en}
              </p>
              <p lang="zh-Hant" className="mt-1 text-supporting text-ink-muted">
                {sentence.zh}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-8 max-w-reading space-y-4 rounded-base border border-line surface-card p-6">
        <p>{t("locked")}</p>
        <p className="text-supporting text-ink-muted">{t("plans")}</p>
        <PreviewActions
          practiceId={preview.id}
          audioUrl={preview.youtubeId ? null : preview.audioUrl}
        />
      </div>

      {preview.attribution && (
        <VideoAttribution
          attribution={preview.attribution}
          className="mt-12 border-t border-line pt-6"
        />
      )}
    </main>
  );
}
