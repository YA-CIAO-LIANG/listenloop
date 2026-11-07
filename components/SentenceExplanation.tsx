import { useTranslations } from "next-intl";
import { Fragment, type ReactNode } from "react";
import {
  markQuote,
  markSentence,
  missedWords,
  touchesMissed,
  type Segment,
} from "@/lib/custom-practice/marks";
import type {
  Chunk,
  ConnectedSpeech,
  RichGrammar,
  RichNotes,
  RichVocab,
} from "@/lib/custom-practice/rich-notes";
import type { GrammarPoint, VocabItem } from "@/lib/videos";
import { Mark, MarkLegend } from "./Mark";

type SentenceExplanationProps = {
  en: string;
  zh: string;
  /** Version 2 notes (D67), or null for the first format. */
  rich: RichNotes | null;
  /** First-format notes for this sentence (built-in videos, older practices). */
  legacy: { vocab: readonly VocabItem[]; grammar: readonly GrammarPoint[] };
  /** Sentence words the learner missed (marks.ts); null before an attempt. */
  missed: ReadonlySet<number> | null;
  /** Show the sentence itself, marked (not where it's already on screen). */
  showSentence?: boolean;
};

/** Renders marked segments, a run of words per mark. */
export function Marked({ segments }: { segments: readonly Segment[] }) {
  return (
    <>
      {segments.map((segment, i) =>
        segment.mark ? (
          <Mark key={i} kind={segment.mark}>
            {segment.text}
          </Mark>
        ) : (
          <Fragment key={i}>{segment.text}</Fragment>
        ),
      )}
    </>
  );
}

const sectionTitle = "text-metadata tracking-widest text-ink-muted uppercase";

/**
 * One sentence explained (D67, D68), as detailed as its difficulty needs:
 * first what the learner misheard ("你這句聽錯的地方": the words, and the
 * vocabulary, grammar, and linked sounds they belong to), then the
 * translation, key words, the structure of a hard sentence chunk by
 * chunk, why it's hard to hear, and the vocabulary and grammar. Mistakes
 * and key words carry the highlighter (D66). First-format notes show the
 * translation, vocabulary, and grammar, with mistakes marked the same way.
 */
export function SentenceExplanation({
  en,
  zh,
  rich,
  legacy,
  missed,
  showSentence = false,
}: SentenceExplanationProps) {
  const t = useTranslations("explain");
  const none = new Set<number>();
  const miss = missed ?? none;
  const hasMistakes = miss.size > 0;
  const keys = rich?.highlights.map((h) => h.text) ?? [];

  // What each item quotes from the sentence, to tell if it was misheard.
  const vocabQuote = (item: RichVocab) => item.inSentence || item.term;
  const missedVocab = rich
    ? rich.vocab.filter((v) => touchesMissed(en, vocabQuote(v), miss))
    : [];
  const missedGrammar = rich
    ? rich.grammar.filter((g) => g.quote && touchesMissed(en, g.quote, miss))
    : [];
  const missedConnected = rich
    ? rich.connected.filter((c) => touchesMissed(en, c.text, miss))
    : [];
  const missedLegacyVocab = rich
    ? []
    : legacy.vocab.filter((v) => touchesMissed(en, v.word, miss));

  return (
    <div className="space-y-6">
      {(rich || hasMistakes) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {rich && (
            <span className="rounded-base border border-line px-2 py-0.5 text-supporting">
              {t("difficultyLabel", {
                difficulty: t(`difficulty.${rich.difficulty}`),
              })}
            </span>
          )}
          {(hasMistakes || keys.length > 0) && (
            <MarkLegend
              kinds={[
                ...(hasMistakes ? (["miss"] as const) : []),
                ...(keys.length > 0 ? (["key"] as const) : []),
              ]}
            />
          )}
        </div>
      )}

      {showSentence && (
        <p lang="en" className="text-sentence">
          <Marked segments={markSentence(en, miss, keys)} />
        </p>
      )}

      {hasMistakes && (
        <section className="space-y-3 rounded-base border border-line p-4">
          <h3 className="font-medium">{t("mistakesTitle")}</h3>
          <p className="text-supporting">
            {t("missedWords")}{" "}
            <span lang="en">
              {missedWords(en, miss).map((word, i) => (
                <Fragment key={i}>
                  {i > 0 && " · "}
                  <Mark kind="miss">{word}</Mark>
                </Fragment>
              ))}
            </span>
          </p>
          {missedVocab.map((item) => (
            <VocabEntry key={item.term} item={item} missed />
          ))}
          {missedLegacyVocab.map((item) => (
            <LegacyVocabEntry key={item.word} item={item} missed />
          ))}
          {missedGrammar.map((point) => (
            <GrammarEntry
              key={point.point}
              point={point}
              en={en}
              missed={miss}
            />
          ))}
          {missedConnected.map((item) => (
            <ConnectedEntry key={item.text} item={item} en={en} missed={miss} />
          ))}
        </section>
      )}

      <p>{zh}</p>

      {rich && rich.highlights.length > 0 && (
        <Section title={t("keyTitle")}>
          <ul className="space-y-1">
            {rich.highlights.map((h) => (
              <li key={h.text}>
                <span lang="en">
                  <Mark kind="key">{h.text}</Mark>
                </span>{" "}
                <span className="text-supporting text-ink-muted">{h.note}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {rich && rich.chunks.length > 0 && (
        <Section title={t("structureTitle")}>
          <ol className="space-y-2">
            {rich.chunks.map((chunk, i) => (
              <ChunkEntry key={i} chunk={chunk} en={en} missed={miss} />
            ))}
          </ol>
          <p className="text-supporting text-ink-muted">
            {t("wholeSentence")} {zh}
          </p>
        </Section>
      )}

      {rich && rich.connected.length > 0 && (
        <Section title={t("connectedTitle")}>
          <ul className="space-y-2">
            {rich.connected
              .filter((c) => !missedConnected.includes(c))
              .map((item) => (
                <li key={item.text}>
                  <ConnectedEntry item={item} en={en} missed={miss} />
                </li>
              ))}
          </ul>
        </Section>
      )}

      {rich
        ? rich.vocab.some((v) => !missedVocab.includes(v)) && (
            <Section title={t("vocabTitle")}>
              {rich.vocab
                .filter((v) => !missedVocab.includes(v))
                .map((item) => (
                  <VocabEntry key={item.term} item={item} />
                ))}
            </Section>
          )
        : legacy.vocab.some((v) => !missedLegacyVocab.includes(v)) && (
            <Section title={t("vocabTitle")}>
              {legacy.vocab
                .filter((v) => !missedLegacyVocab.includes(v))
                .map((item) => (
                  <LegacyVocabEntry key={item.word} item={item} />
                ))}
            </Section>
          )}

      {rich
        ? rich.grammar.some((g) => !missedGrammar.includes(g)) && (
            <Section title={t("grammarTitle")}>
              {rich.grammar
                .filter((g) => !missedGrammar.includes(g))
                .map((point) => (
                  <GrammarEntry
                    key={point.point}
                    point={point}
                    en={en}
                    missed={miss}
                  />
                ))}
            </Section>
          )
        : legacy.grammar.length > 0 && (
            <Section title={t("grammarTitle")}>
              {legacy.grammar.map((point) => (
                <div key={point.point}>
                  <p lang="en" className="font-medium">
                    {point.point}
                  </p>
                  <p className="mt-1 text-supporting text-ink-muted">
                    {point.explanation}
                  </p>
                </div>
              ))}
            </Section>
          )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className={sectionTitle}>{title}</h3>
      {children}
    </section>
  );
}

function Examples({ examples }: { examples: RichVocab["examples"] }) {
  return (
    <ul className="space-y-1">
      {examples.map((example) => (
        <li key={example.en} className="text-supporting">
          <span lang="en">{example.en}</span>
          <span className="block text-ink-muted">{example.zh}</span>
        </li>
      ))}
    </ul>
  );
}

function VocabEntry({
  item,
  missed = false,
}: {
  item: RichVocab;
  missed?: boolean;
}) {
  const t = useTranslations("explain");
  return (
    <div className="space-y-1">
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span lang="en" className="font-medium">
          {missed ? <Mark kind="miss">{item.term}</Mark> : item.term}
        </span>
        {item.ipa && (
          <span lang="en" className="text-supporting text-ink-muted">
            {item.ipa}
          </span>
        )}
        <span lang="en" className="text-supporting text-ink-muted">
          {item.pos}
        </span>
        {item.kind !== "word" && (
          <span className="text-supporting text-ink-muted">
            {t(`kinds.${item.kind}`)}
          </span>
        )}
        <span>{item.zh}</span>
      </p>
      {item.collocations.length > 0 && (
        <p className="text-supporting text-ink-muted">
          {t("collocations")}{" "}
          <span lang="en">{item.collocations.join(" · ")}</span>
        </p>
      )}
      <Examples examples={item.examples} />
    </div>
  );
}

function LegacyVocabEntry({
  item,
  missed = false,
}: {
  item: VocabItem;
  missed?: boolean;
}) {
  return (
    <p>
      <span lang="en" className="font-medium">
        {missed ? <Mark kind="miss">{item.word}</Mark> : item.word}
      </span>{" "}
      <span className="text-supporting text-ink-muted">{item.pos}</span>{" "}
      {item.zh}
    </p>
  );
}

function GrammarEntry({
  point,
  en,
  missed,
}: {
  point: RichGrammar;
  en: string;
  missed: ReadonlySet<number>;
}) {
  const t = useTranslations("explain");
  return (
    <div className="space-y-1">
      <p lang="en" className="font-medium">
        {point.point}
      </p>
      <p className="text-supporting">{point.explanation}</p>
      {point.quote && (
        <p className="text-supporting text-ink-muted">
          {t("inThisSentence")}{" "}
          <span lang="en">
            <Marked segments={markQuote(en, point.quote, missed)} />
          </span>
        </p>
      )}
      <Examples examples={point.examples} />
      {point.pitfall && (
        <p className="text-supporting text-ink-muted">
          {t("pitfall")} {point.pitfall}
        </p>
      )}
    </div>
  );
}

function ChunkEntry({
  chunk,
  en,
  missed,
}: {
  chunk: Chunk;
  en: string;
  missed: ReadonlySet<number>;
}) {
  const t = useTranslations("explain");
  return (
    <li className="grid gap-x-3 split:grid-cols-[7rem_1fr]">
      <span className="text-supporting text-ink-muted">
        ［{t(`roles.${chunk.role}`)}］
      </span>
      <span>
        <span lang="en" className="block">
          <Marked segments={markQuote(en, chunk.text, missed)} />
        </span>
        <span className="block text-supporting text-ink-muted">{chunk.zh}</span>
      </span>
    </li>
  );
}

function ConnectedEntry({
  item,
  en,
  missed,
}: {
  item: ConnectedSpeech;
  en: string;
  missed: ReadonlySet<number>;
}) {
  const t = useTranslations("explain");
  return (
    <div className="space-y-1">
      <p>
        <span lang="en" className="font-medium">
          <Marked segments={markQuote(en, item.text, missed)} />
        </span>{" "}
        <span className="text-supporting text-ink-muted">
          {t("soundsLike", { sound: item.soundsLike })}
        </span>
      </p>
      <p className="text-supporting text-ink-muted">{item.note}</p>
    </div>
  );
}
