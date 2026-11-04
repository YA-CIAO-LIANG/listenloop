import type {
  GenerateAudioResult,
  GenerateNotesResult,
} from "@/app/materials/actions";

export type GenerateAudio = (
  practiceId: string,
) => Promise<GenerateAudioResult>;
export type GenerateNotes = (
  practiceId: string,
) => Promise<GenerateNotesResult>;

/**
 * Calls the server batch by batch until every sentence has audio,
 * reporting progress after each batch. Stops on the first error, or if a
 * batch makes no progress (so it can never loop forever).
 */
export async function generateAllAudio(
  generate: GenerateAudio,
  practiceId: string,
  onProgress: (voiced: number, total: number) => void,
): Promise<GenerateAudioResult> {
  let previous = -1;
  for (;;) {
    const result = await generate(practiceId).catch(
      (): GenerateAudioResult => ({ ok: false, reason: "failed" }),
    );
    if (result.voiced !== undefined && result.total !== undefined) {
      onProgress(result.voiced, result.total);
    }
    if (!result.ok || result.voiced >= result.total) return result;
    if (result.voiced <= previous)
      return { ...result, ok: false, reason: "failed" };
    previous = result.voiced;
  }
}

/** What's being made right now, for the progress line. */
export type GenerationStage =
  { stage: "notes" } | { stage: "audio"; voiced: number; total: number };

export type GenerationResult =
  | { ok: true }
  | {
      ok: false;
      stage: "notes" | "audio";
      reason: Exclude<
        GenerateNotesResult | GenerateAudioResult,
        { ok: true }
      >["reason"];
    };

/**
 * Gets a saved practice ready to practice (D27): its notes first, then its
 * audio. Each step skips what's already done, so the same call both
 * finishes a new practice and continues an interrupted one.
 */
export async function prepareForPractice(
  actions: { generateNotes: GenerateNotes; generate: GenerateAudio },
  practiceId: string,
  notesReady: boolean,
  onStage: (stage: GenerationStage) => void,
): Promise<GenerationResult> {
  if (!notesReady) {
    onStage({ stage: "notes" });
    const notes = await actions
      .generateNotes(practiceId)
      .catch((): GenerateNotesResult => ({ ok: false, reason: "failed" }));
    if (!notes.ok) return { ok: false, stage: "notes", reason: notes.reason };
  }
  const audio = await generateAllAudio(
    actions.generate,
    practiceId,
    (voiced, total) => onStage({ stage: "audio", voiced, total }),
  );
  return audio.ok
    ? { ok: true }
    : { ok: false, stage: "audio", reason: audio.reason };
}
