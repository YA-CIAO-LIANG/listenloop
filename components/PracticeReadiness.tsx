"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  generatePracticeAudio,
  generatePracticeNotes,
} from "@/app/materials/actions";
import { Button } from "./Button";
import { ButtonLink } from "./ButtonLink";
import {
  prepareForPractice,
  type GenerateAudio,
  type GenerateNotes,
  type GenerationResult,
  type GenerationStage,
} from "./practice-generation";

type PracticeReadinessProps = {
  practiceId: string;
  /** Where to practice once everything is ready. */
  practiceHref: string;
  notesReady: boolean;
  voiced: number;
  total: number;
  /** Injected in tests; the Server Actions otherwise. */
  generate?: GenerateAudio;
  generateNotes?: GenerateNotes;
};

/**
 * Whether a created practice can be practiced: its notes and audio are
 * ready, or what's missing with a button to continue (after the daily
 * limit, an error, or a closed tab).
 */
export function PracticeReadiness({
  practiceId,
  practiceHref,
  notesReady: initialNotesReady,
  voiced: initialVoiced,
  total,
  generate = generatePracticeAudio,
  generateNotes = generatePracticeNotes,
}: PracticeReadinessProps) {
  const t = useTranslations("create");
  const router = useRouter();
  const [notesReady, setNotesReady] = useState(initialNotesReady);
  const [voiced, setVoiced] = useState(initialVoiced);
  const [stage, setStage] = useState<GenerationStage | null>(null);
  const [error, setError] = useState<Extract<
    GenerationResult,
    { ok: false }
  > | null>(null);

  async function resume() {
    setError(null);
    const result = await prepareForPractice(
      { generate, generateNotes },
      practiceId,
      notesReady,
      (next) => {
        setStage(next);
        if (next.stage === "audio") {
          setNotesReady(true);
          setVoiced(next.voiced);
        }
      },
    );
    setStage(null);
    if (!result.ok) setError(result);
    else router.refresh();
  }

  if (notesReady && voiced >= total && !stage) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-supporting text-success">
          <span aria-hidden="true">✓ </span>
          {t("readyDone")}
        </p>
        <ButtonLink href={practiceHref} variant="primary" size="sm" arrow>
          {t("startPractice")}
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        {stage ? (
          <p
            role="status"
            className="text-supporting text-ink-muted tabular-nums"
          >
            {stage.stage === "notes"
              ? t("generatingNotes")
              : t("generating", { voiced: stage.voiced, total: stage.total })}
          </p>
        ) : (
          <p className="text-supporting text-ink-muted tabular-nums">
            {t("statusLine", {
              notes: t(notesReady ? "notesDone" : "notesPending"),
              audio: t("audioPartial", { voiced, total }),
            })}
          </p>
        )}
        <Button size="sm" onClick={resume} disabled={stage !== null}>
          {t("resume")}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-supporting text-error">
          {t(
            `${error.stage === "notes" ? "notesErrors" : "audioErrors"}.${error.reason}`,
          )}
        </p>
      )}
    </div>
  );
}
