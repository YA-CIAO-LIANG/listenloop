import type { GenerateAudioResult } from "@/app/materials/actions";

export type GenerateAudio = (
  practiceId: string,
) => Promise<GenerateAudioResult>;

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
