import { useTranslations } from "next-intl";
import { notesForSentence, type Video } from "@/lib/videos";

type SentenceNotesProps = {
  video: Pick<Video, "sentences" | "vocab" | "grammar">;
  index: number;
};

/**
 * What one sentence means, shown after it is answered: the Chinese
 * translation, then its vocabulary and grammar. Examples stay in the handout
 * to keep this short.
 */
export function SentenceNotes({ video, index }: SentenceNotesProps) {
  const t = useTranslations("handout");
  const { vocab, grammar } = notesForSentence(video, index);

  return (
    <div className="space-y-6 border-t border-line pt-6">
      <p>{video.sentences[index].zh}</p>

      {vocab.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-metadata tracking-widest text-ink-muted uppercase">
            {t("vocab")}
          </h2>
          <ul className="space-y-1">
            {vocab.map((item) => (
              <li key={item.word}>
                <span lang="en" className="font-medium">
                  {item.word}
                </span>{" "}
                <span className="text-supporting text-ink-muted">
                  {item.pos}
                </span>{" "}
                {item.zh}
              </li>
            ))}
          </ul>
        </section>
      )}

      {grammar.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-metadata tracking-widest text-ink-muted uppercase">
            {t("grammar")}
          </h2>
          <ul className="space-y-3">
            {grammar.map((point) => (
              <li key={point.point}>
                <p lang="en" className="font-medium">
                  {point.point}
                </p>
                <p className="mt-1 text-supporting text-ink-muted">
                  {point.explanation}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
