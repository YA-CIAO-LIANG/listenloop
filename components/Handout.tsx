"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import {
  markQuote,
  markSentence,
  missedPieces,
  touchesMissed,
} from "@/lib/custom-practice/marks";
import type { RichNotes } from "@/lib/custom-practice/rich-notes";
import type { PracticeMaterial } from "@/lib/practice-material";
import { useDay1Answers } from "./HandoutGate";
import { MarkLegend, Mark } from "./Mark";
import { Marked } from "./SentenceExplanation";
import { VideoAttribution } from "./VideoAttribution";

/**
 * Bilingual handout: each English sentence with its Chinese below, a
 * vocabulary table, grammar points, and the video credit. Print-friendly:
 * items never split across pages; the vocabulary rows keep four columns on
 * paper and stack on narrow screens.
 *
 * For review (D68), the words misheard on Day 1 this week are marked with
 * the highlighter in the sentences, and so are the words and grammar
 * points they belong to; each sentence's key words get the "key" mark.
 * Version 2 notes (D67) add each hard sentence's chunks, the sounds that
 * are hard to hear, IPA, and examples with their Chinese.
 */
export function Handout({ video }: { video: PracticeMaterial }) {
  const t = useTranslations("handout");
  const tExplain = useTranslations("explain");
  const answers = useDay1Answers();
  const missedOf = (i: number) => {
    const answer = answers?.[i];
    return typeof answer === "string"
      ? missedPieces(video.sentences[i].en, answer)
      : new Set<number>();
  };
  const missed = video.sentences.map((_, i) => missedOf(i));
  const rich = video.richNotes ?? [];
  const anyMissed = missed.some((m) => m.size > 0);
  const anyKey = rich.some((notes) => (notes?.highlights.length ?? 0) > 0);
  const richVocab = rich.flatMap((notes, i) =>
    (notes?.vocab ?? []).map((item) => ({ ...item, sentence: i })),
  );
  const richGrammar = rich.flatMap((notes, i) =>
    (notes?.grammar ?? []).map((point) => ({ ...point, sentence: i })),
  );
  const vocabMissed = (sentence: number, quote: string) =>
    touchesMissed(video.sentences[sentence].en, quote, missed[sentence]);

  return (
    <div className="space-y-12 print:space-y-8">
      <HandoutSection title={t("sentences")}>
        {(anyMissed || anyKey) && (
          <div className="mb-6 space-y-1">
            <MarkLegend
              kinds={[
                ...(anyMissed ? (["miss"] as const) : []),
                ...(anyKey ? (["key"] as const) : []),
              ]}
            />
            {anyMissed && (
              <p className="text-supporting text-ink-muted">{t("marksNote")}</p>
            )}
          </div>
        )}
        <ol className="space-y-5">
          {video.sentences.map((sentence) => {
            const notes: RichNotes | null = rich[sentence.i] ?? null;
            return (
              <li
                key={sentence.i}
                className="grid break-inside-avoid grid-cols-[2rem_1fr] gap-x-3"
              >
                <span className="pt-1 text-metadata text-ink-muted tabular-nums">
                  {String(sentence.i + 1).padStart(2, "0")}
                </span>
                <div>
                  <p lang="en" className="text-sentence">
                    <Marked
                      segments={markSentence(
                        sentence.en,
                        missed[sentence.i],
                        notes?.highlights.map((h) => h.text) ?? [],
                      )}
                    />
                  </p>
                  <p className="mt-1 text-supporting text-ink-muted">
                    {sentence.zh}
                  </p>
                  {notes && notes.chunks.length > 0 && (
                    <ol className="mt-2 space-y-1 text-supporting">
                      {notes.chunks.map((chunk, k) => (
                        <li key={k}>
                          <span className="text-ink-muted">
                            ［{tExplain(`roles.${chunk.role}`)}］
                          </span>{" "}
                          <span lang="en">
                            <Marked
                              segments={markQuote(
                                sentence.en,
                                chunk.text,
                                missed[sentence.i],
                              )}
                            />
                          </span>{" "}
                          <span className="text-ink-muted">{chunk.zh}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                  {notes && notes.connected.length > 0 && (
                    <p className="mt-2 text-supporting text-ink-muted">
                      {tExplain("connectedTitle")}：
                      {notes.connected.map((item, k) => (
                        <span key={k}>
                          {k > 0 && "；"}
                          <span lang="en" className="text-ink">
                            <Marked
                              segments={markQuote(
                                sentence.en,
                                item.text,
                                missed[sentence.i],
                              )}
                            />
                          </span>{" "}
                          {tExplain("soundsLike", { sound: item.soundsLike })}
                        </span>
                      ))}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </HandoutSection>

      {richVocab.length > 0 ? (
        <HandoutSection title={t("vocab")}>
          <div role="table" aria-label={t("vocab")}>
            <VocabHeader />
            {richVocab.map((item) => (
              <div
                role="row"
                key={`${item.sentence}:${item.term}`}
                className="grid break-inside-avoid gap-1 border-b border-line py-3 split:grid-cols-[9rem_5rem_9rem_1fr] split:gap-4 print:grid-cols-[8rem_3rem_7rem_1fr] print:gap-3"
              >
                <span role="cell" lang="en">
                  <span className="font-medium">
                    {vocabMissed(
                      item.sentence,
                      item.inSentence || item.term,
                    ) ? (
                      <Mark kind="miss">{item.term}</Mark>
                    ) : (
                      item.term
                    )}
                  </span>
                  {item.ipa && (
                    <span className="block text-supporting text-ink-muted">
                      {item.ipa}
                    </span>
                  )}
                </span>
                <span
                  role="cell"
                  lang="en"
                  className="text-supporting text-ink-muted"
                >
                  {item.pos}
                </span>
                <span role="cell">
                  {item.zh}
                  {item.collocations.length > 0 && (
                    <span
                      lang="en"
                      className="block text-supporting text-ink-muted"
                    >
                      {item.collocations.join(" · ")}
                    </span>
                  )}
                </span>
                <span role="cell" className="text-supporting text-ink-muted">
                  {item.examples.map((example) => (
                    <span key={example.en} className="block">
                      <span lang="en">{example.en}</span>
                      <span className="block">{example.zh}</span>
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </HandoutSection>
      ) : (
        video.vocab.length > 0 && (
          <HandoutSection title={t("vocab")}>
            <div role="table" aria-label={t("vocab")}>
              <VocabHeader />
              {video.vocab.map((item) => (
                <div
                  role="row"
                  key={item.word}
                  className="grid break-inside-avoid gap-1 border-b border-line py-3 split:grid-cols-[9rem_5rem_9rem_1fr] split:gap-4 print:grid-cols-[8rem_3rem_7rem_1fr] print:gap-3"
                >
                  <span role="cell" lang="en" className="font-medium">
                    {vocabMissed(item.sentence, item.word) ? (
                      <Mark kind="miss">{item.word}</Mark>
                    ) : (
                      item.word
                    )}
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
        )
      )}

      {richGrammar.length > 0 ? (
        <HandoutSection title={t("grammar")}>
          <ol className="space-y-6">
            {richGrammar.map((point) => (
              <li
                key={`${point.sentence}:${point.point}`}
                className="break-inside-avoid"
              >
                <p lang="en" className="font-display text-h3">
                  {point.quote && vocabMissed(point.sentence, point.quote) ? (
                    <Mark kind="miss">{point.point}</Mark>
                  ) : (
                    point.point
                  )}
                </p>
                <p className="mt-1">{point.explanation}</p>
                {point.quote && (
                  <p className="mt-1 text-supporting text-ink-muted">
                    {tExplain("inThisSentence")}{" "}
                    <span lang="en">
                      <Marked
                        segments={markQuote(
                          video.sentences[point.sentence].en,
                          point.quote,
                          missed[point.sentence],
                        )}
                      />
                    </span>
                  </p>
                )}
                {point.examples.map((example) => (
                  <p
                    key={example.en}
                    className="mt-1 text-supporting text-ink-muted"
                  >
                    <span className="sr-only">{t("example")}: </span>
                    <span lang="en">{example.en}</span> {example.zh}
                  </p>
                ))}
                {point.pitfall && (
                  <p className="mt-1 text-supporting text-ink-muted">
                    {tExplain("pitfall")} {point.pitfall}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </HandoutSection>
      ) : (
        video.grammar.length > 0 && (
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
        )
      )}

      {video.attribution && (
        <VideoAttribution
          attribution={video.attribution}
          className="break-inside-avoid border-t border-line pt-6"
        />
      )}
    </div>
  );
}

function VocabHeader() {
  const t = useTranslations("handout");
  return (
    <div
      role="row"
      className="hidden border-b border-line pb-2 text-metadata tracking-widest text-ink-muted uppercase split:grid split:grid-cols-[9rem_5rem_9rem_1fr] split:gap-4 print:grid print:grid-cols-[8rem_3rem_7rem_1fr] print:gap-3"
    >
      <span role="columnheader">{t("columns.word")}</span>
      <span role="columnheader">{t("columns.pos")}</span>
      <span role="columnheader">{t("columns.meaning")}</span>
      <span role="columnheader">{t("columns.example")}</span>
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
