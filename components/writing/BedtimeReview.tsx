"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  logReview,
  matchRecall,
  RECALL_COUNT,
  todaysSentences,
} from "@/lib/writing/bedtime";
import { Button } from "../Button";
import { ButtonLink } from "../ButtonLink";
import { Card } from "../Card";
import { useToday } from "../useToday";
import {
  useAllWritingProgress,
  useNotebook,
  useWritingData,
  useWritingLog,
} from "./WritingProvider";

/**
 * The evening review (D203, learning-science.md §13): three sentences
 * learned today written from memory, nothing shown first; then today's
 * sentences, the ones recalled marked. About three minutes.
 */
export function BedtimeReview() {
  const t = useTranslations("writing.bedtime");
  const today = useToday();
  const progresses = useAllWritingProgress();
  const notebook = useNotebook();
  const log = useWritingLog();
  const { updateLog } = useWritingData();
  const [lines, setLines] = useState<string[]>(() =>
    Array.from({ length: RECALL_COUNT }, () => ""),
  );
  const [shown, setShown] = useState(false);
  if (!today || !progresses || !notebook || !log) return null;
  const sentences = todaysSentences(progresses, notebook, today);
  if (sentences.length === 0) {
    return (
      <Card className="flex flex-col gap-3">
        <p>{t("nothing")}</p>
        <div>
          <ButtonLink href="/writing" variant="secondary" size="sm">
            {t("toWriting")}
          </ButtonLink>
        </div>
      </Card>
    );
  }
  const results = matchRecall(lines, sentences);
  const recalled = new Set(results.flatMap((r) => (r.match ? [r.match] : [])));

  const show = () => {
    setShown(true);
    updateLog((current) => logReview(current, today, recalled.size));
  };

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3" disabled={shown}>
        <legend className="mb-2 font-medium">
          {t("prompt", { count: RECALL_COUNT })}
        </legend>
        {lines.map((line, i) => (
          <label key={i} className="flex flex-col gap-1">
            <span className="text-supporting">{t("line", { n: i + 1 })}</span>
            <input
              type="text"
              lang="en"
              value={line}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) =>
                setLines(lines.map((l, j) => (j === i ? e.target.value : l)))
              }
              className="min-h-11 w-full rounded-base border border-line bg-surface px-3 focus:border-ink"
            />
          </label>
        ))}
      </fieldset>
      {!shown ? (
        <div className="flex flex-wrap gap-3">
          <Button
            variant="primary"
            onClick={show}
            disabled={lines.every((l) => !l.trim())}
          >
            {t("compare")}
          </Button>
          <ButtonLink href="/writing" variant="ghost">
            {t("later")}
          </ButtonLink>
        </div>
      ) : (
        <section
          aria-labelledby="bedtime-result"
          role="status"
          className="flex flex-col gap-3"
        >
          <h2 id="bedtime-result" className="font-display text-h3">
            {t("result", { count: recalled.size, total: RECALL_COUNT })}
          </h2>
          <p className="text-supporting text-ink-muted">{t("resultNote")}</p>
          <ul className="flex flex-col gap-2">
            {sentences.map((en) => (
              <li key={en} className="flex gap-2 text-supporting">
                <span
                  aria-hidden="true"
                  className={
                    recalled.has(en) ? "text-success" : "text-ink-muted"
                  }
                >
                  {recalled.has(en) ? "✓" : "・"}
                </span>
                <span>
                  <span lang="en">{en}</span>
                  {recalled.has(en) && (
                    <span className="sr-only"> {t("recalled")}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/writing" variant="primary">
              {t("done")}
            </ButtonLink>
          </div>
        </section>
      )}
    </div>
  );
}
