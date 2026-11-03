"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  generatePracticeAudio,
  type GenerateAudioResult,
} from "@/app/create/actions";
import { generateAllAudio, type GenerateAudio } from "./audio-generation";
import { Button } from "./Button";

type PracticeAudioStatusProps = {
  practiceId: string;
  voiced: number;
  total: number;
  /** Injected in tests; the Server Action otherwise. */
  generate?: GenerateAudio;
};

/**
 * A created practice's audio: ready, or how far along it is with a button
 * to continue (after the daily limit, an error, or a closed tab).
 */
export function PracticeAudioStatus({
  practiceId,
  voiced: initialVoiced,
  total: initialTotal,
  generate = generatePracticeAudio,
}: PracticeAudioStatusProps) {
  const t = useTranslations("create");
  const router = useRouter();
  const [progress, setProgress] = useState({
    voiced: initialVoiced,
    total: initialTotal,
  });
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<
    Exclude<GenerateAudioResult, { ok: true }>["reason"] | null
  >(null);

  async function resume() {
    setRunning(true);
    setError(null);
    const result = await generateAllAudio(
      generate,
      practiceId,
      (voiced, total) => setProgress({ voiced, total }),
    );
    setRunning(false);
    if (!result.ok) setError(result.reason);
    else router.refresh();
  }

  if (progress.voiced >= progress.total) {
    return (
      <p className="text-supporting text-success">
        <span aria-hidden="true">✓ </span>
        {t("audioDone")}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <p
          role={running ? "status" : undefined}
          className="text-supporting text-ink-muted tabular-nums"
        >
          {t(running ? "generating" : "audioPartial", progress)}
        </p>
        <Button size="sm" onClick={resume} disabled={running}>
          {t("resumeAudio")}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-supporting text-error">
          {t(`audioErrors.${error}`)}
        </p>
      )}
    </div>
  );
}
