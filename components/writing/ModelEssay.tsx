"use client";

import { useTranslations } from "next-intl";
import { Fragment, type ReactNode } from "react";
import { Mark } from "../Mark";
import type { WritingPrompt } from "@/lib/writing/types";
import { findQuotes } from "./FeedbackView";

/**
 * The model essay (D187), only after the learner's own Day 1 (the
 * generation effect): its useful patterns highlighted and numbered, each
 * paragraph's translation folded, then the patterns explained.
 */
export function ModelEssay({
  prompt,
  folded = false,
}: {
  prompt: WritingPrompt;
  /**
   * Folded under "Show the model essay" (D218): Days 2–6 practice the
   * learner's own essay; the model essay only when asked for.
   */
  folded?: boolean;
}) {
  const t = useTranslations("writing.model");
  const tRewrite = useTranslations("writing.rewrite");
  // A custom prompt has no model essay (D196).
  if (prompt.model.en.length === 0) return null;
  if (folded) {
    return (
      <details
        className="rounded-base border border-line bg-surface"
        data-testid="model-essay-folded"
      >
        <summary className="tap flex min-h-11 cursor-pointer items-center px-3 py-2 text-supporting">
          {tRewrite("modelToggle")}
        </summary>
        <div className="border-t border-line p-3">
          <ModelEssay prompt={prompt} />
        </div>
      </details>
    );
  }
  const examples = prompt.patterns.map((p) => p.example);
  const mark = (paragraph: string) => {
    const parts: ReactNode[] = [];
    let at = 0;
    for (const m of findQuotes(paragraph, examples)) {
      parts.push(paragraph.slice(at, m.start));
      parts.push(
        <Fragment key={m.start}>
          <Mark kind="key">{paragraph.slice(m.start, m.end)}</Mark>
          <sup className="font-medium text-accent-ink">{m.n}</sup>
        </Fragment>,
      );
      at = m.end;
    }
    parts.push(paragraph.slice(at));
    return parts;
  };
  return (
    <section aria-labelledby="model-essay" className="flex flex-col gap-4">
      <h2 id="model-essay" className="font-display text-h3">
        {t("heading")}
      </h2>
      <p className="text-supporting text-ink-muted">{t("intro")}</p>
      <div className="flex max-w-reading flex-col gap-3">
        {prompt.model.en.map((paragraph, i) => (
          <div key={i} className="flex flex-col gap-1">
            <p lang="en" className="leading-relaxed">
              {mark(paragraph)}
            </p>
            <details>
              <summary className="cursor-pointer text-supporting text-ink-muted">
                {t("translation")}
              </summary>
              <p className="mt-1 text-supporting">{prompt.model.zh[i]}</p>
            </details>
          </div>
        ))}
      </div>
      <h3 className="font-medium">{t("patterns")}</h3>
      <ol className="flex flex-col gap-2">
        {prompt.patterns.map((p, i) => (
          <li key={i} className="text-supporting">
            <span className="mr-2 tabular-nums">{i + 1}.</span>
            <span lang="en" className="font-medium">
              {p.pattern}
            </span>{" "}
            — {p.zh}
          </li>
        ))}
      </ol>
    </section>
  );
}
