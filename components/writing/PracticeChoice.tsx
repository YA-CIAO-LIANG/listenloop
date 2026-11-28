"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { WritingProgress } from "@/lib/writing/progress";
import type { WritingPrompt } from "@/lib/writing/types";
import { Button } from "../Button";
import { Card } from "../Card";
import { RewritePanel } from "./RewritePanel";
import { useWritingData } from "./WritingProvider";

/**
 * Before Day 2 (D218): Days 2–6 practice the learner's own essay as
 * corrected, so a version must be chosen first. Without one yet, the AI
 * is asked to correct the essay (counted in the AI allowance), or the
 * learner practices the model essay instead (no AI). A guest can only
 * do the latter, or sign in.
 */
export function PracticeChoice({
  prompt,
  progress,
  signedIn,
}: {
  prompt: WritingPrompt;
  progress: WritingProgress;
  signedIn: boolean;
}) {
  const t = useTranslations("writing.rewrite");
  const { saveProgress } = useWritingData();
  const day1 = progress.days[1];
  if (!day1) return null;
  const hasVersions = (day1.rewrite?.versions.length ?? 0) > 0;
  // A custom prompt has no model essay (D196).
  const hasModel = prompt.model.en.length > 0;
  const useModel = () =>
    saveProgress({
      ...progress,
      days: { ...progress.days, 1: { ...day1, source: "model" } },
      updatedAt: new Date().toISOString(),
    });
  return (
    <div className="flex flex-col gap-6" data-testid="practice-choice">
      <Card className="flex flex-col gap-3">
        <h2 className="font-display text-h3">{t("gate.heading")}</h2>
        <p className="max-w-reading">
          {hasVersions ? t("gate.introChoose") : t("gate.intro")}
        </p>
        {!signedIn && (
          <p className="text-supporting">
            {t("gate.guest")}{" "}
            <Link
              href={`/login?next=/writing/${prompt.id}/day/2`}
              className="underline"
            >
              {t("signInLink")}
            </Link>
          </p>
        )}
        {hasModel && (
          <div className="flex flex-col gap-1">
            <div>
              <Button variant="secondary" onClick={useModel}>
                {t("gate.useModel")}
              </Button>
            </div>
            <p className="text-metadata text-ink-muted">
              {t("gate.useModelNote")}
            </p>
          </div>
        )}
      </Card>
      {signedIn && (
        <RewritePanel prompt={prompt} progress={progress} signedIn />
      )}
    </div>
  );
}
