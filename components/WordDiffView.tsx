import { useTranslations } from "next-intl";
import { Fragment } from "react";
import type { DisplayWord, WordDiff } from "@/lib/scoring/word-diff";

/**
 * Two-line dictation feedback: the user's answer with wrong or extra words
 * struck through, then the correct sentence with words they missed
 * underlined. Never color alone: strikethrough and underline carry meaning.
 */
export function WordDiffView({ diff }: { diff: WordDiff }) {
  const t = useTranslations("dictation");

  return (
    <dl className="grid gap-x-4 gap-y-2 text-sentence split:grid-cols-[auto_1fr]">
      <dt className="text-metadata tracking-widest text-ink-muted uppercase split:pt-2">
        {t("yourAnswer")}
      </dt>
      <dd lang="en">
        {diff.answer.length === 0 ? (
          <span className="text-ink-muted">{t("noAnswer")}</span>
        ) : (
          <Words
            words={diff.answer}
            render={(word) => (
              <del className="text-error decoration-1">{word.text}</del>
            )}
          />
        )}
      </dd>
      <dt className="text-metadata tracking-widest text-ink-muted uppercase split:pt-2">
        {t("correctAnswer")}
      </dt>
      <dd lang="en">
        <Words
          words={diff.reference}
          render={(word) => (
            <span className="text-error underline decoration-2 underline-offset-4">
              {word.text}
              <span className="sr-only">{t("missed")}</span>
            </span>
          )}
        />
      </dd>
    </dl>
  );
}

function Words({
  words,
  render,
}: {
  words: DisplayWord[];
  render: (word: DisplayWord) => React.ReactNode;
}) {
  return words.map((word, index) => (
    <Fragment key={index}>
      {index > 0 && " "}
      {word.ok ? word.text : render(word)}
    </Fragment>
  ));
}
