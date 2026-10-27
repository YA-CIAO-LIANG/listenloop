import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { Video } from "@/lib/videos";
import { VideoAttribution } from "./VideoAttribution";

/**
 * Bilingual handout: each English sentence with its Chinese below, a
 * vocabulary table, grammar points, and the video credit. Print-friendly:
 * items never split across pages; the vocabulary rows keep four columns on
 * paper and stack on narrow screens.
 */
export function Handout({ video }: { video: Video }) {
  const t = useTranslations("handout");

  return (
    <div className="space-y-12 print:space-y-8">
      <HandoutSection title={t("sentences")}>
        <ol className="space-y-5">
          {video.sentences.map((sentence) => (
            <li
              key={sentence.i}
              className="grid break-inside-avoid grid-cols-[2rem_1fr] gap-x-3"
            >
              <span className="pt-1 text-metadata text-ink-muted tabular-nums">
                {String(sentence.i + 1).padStart(2, "0")}
              </span>
              <div>
                <p lang="en" className="text-sentence">
                  {sentence.en}
                </p>
                <p className="mt-1 text-supporting text-ink-muted">
                  {sentence.zh}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </HandoutSection>

      {video.vocab.length > 0 && (
        <HandoutSection title={t("vocab")}>
          <div role="table" aria-label={t("vocab")}>
            <div
              role="row"
              className="hidden border-b border-line pb-2 text-metadata tracking-widest text-ink-muted uppercase split:grid split:grid-cols-[9rem_5rem_9rem_1fr] split:gap-4 print:grid print:grid-cols-[8rem_3rem_7rem_1fr] print:gap-3"
            >
              <span role="columnheader">{t("columns.word")}</span>
              <span role="columnheader">{t("columns.pos")}</span>
              <span role="columnheader">{t("columns.meaning")}</span>
              <span role="columnheader">{t("columns.example")}</span>
            </div>
            {video.vocab.map((item) => (
              <div
                role="row"
                key={item.word}
                className="grid break-inside-avoid gap-1 border-b border-line py-3 split:grid-cols-[9rem_5rem_9rem_1fr] split:gap-4 print:grid-cols-[8rem_3rem_7rem_1fr] print:gap-3"
              >
                <span role="cell" lang="en" className="font-medium">
                  {item.word}
                </span>
                <span
                  role="cell"
                  lang="en"
                  className="text-supporting text-ink-muted"
                >
                  {item.pos}
                </span>
                <span role="cell">{item.zh}</span>
                <span
                  role="cell"
                  lang="en"
                  className="text-supporting text-ink-muted"
                >
                  {item.example}
                </span>
              </div>
            ))}
          </div>
        </HandoutSection>
      )}

      {video.grammar.length > 0 && (
        <HandoutSection title={t("grammar")}>
          <ol className="space-y-6">
            {video.grammar.map((point) => (
              <li key={point.point} className="break-inside-avoid">
                <p lang="en" className="font-display text-h3">
                  {point.point}
                </p>
                <p className="mt-1">{point.explanation}</p>
                <p className="mt-1 text-supporting text-ink-muted">
                  <span className="sr-only">{t("example")}: </span>
                  <span lang="en">{point.example}</span>
                </p>
              </li>
            ))}
          </ol>
        </HandoutSection>
      )}

      <VideoAttribution
        attribution={video.attribution}
        className="break-inside-avoid border-t border-line pt-6"
      />
    </div>
  );
}

function HandoutSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-6 font-display text-h2 print:mb-4">{title}</h2>
      {children}
    </section>
  );
}
