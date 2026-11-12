"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "./Button";
import { ButtonLink } from "./ButtonLink";

/**
 * After Day 1's or Day 7's dictation: the vocabulary quiz (D136), which
 * can be skipped (it then just goes away; the quiz stays on the
 * material's page).
 */
export function QuizInvite({ videoId, day }: { videoId: string; day: 1 | 7 }) {
  const t = useTranslations("quiz");
  const [skipped, setSkipped] = useState(false);
  if (skipped) return null;
  return (
    <section
      aria-labelledby="quiz-invite"
      className="space-y-3 rounded-base border border-accent bg-band p-4"
    >
      <h3 id="quiz-invite" className="font-medium">
        {t("cardTitle")}
      </h3>
      <p className="text-supporting text-ink-muted">{t("cardBody")}</p>
      <div className="flex flex-wrap gap-3">
        <ButtonLink
          href={`/videos/${videoId}/quiz${day === 7 ? "?day=7" : ""}`}
          variant="primary"
          size="sm"
          arrow
        >
          {t("start")}
        </ButtonLink>
        <Button variant="ghost" size="sm" onClick={() => setSkipped(true)}>
          {t("skip")}
        </Button>
      </div>
    </section>
  );
}
