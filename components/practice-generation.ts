import type {
  GenerateAudioResult,
  GenerateNotesResult,
  SplitResult,
  TranslateResult,
} from "@/app/materials/actions";
import {
  PRACTICE_LIMITS,
  type DraftSentence,
} from "@/lib/custom-practice/draft";
import { TRANSLATE_BATCH } from "@/lib/custom-practice/notes";
import {
  splitSentences,
  type TextSourceLanguage,
} from "@/lib/custom-practice/split";

export type GenerateAudio = (
  practiceId: string,
) => Promise<GenerateAudioResult>;
export type GenerateNotes = (
  practiceId: string,
) => Promise<GenerateNotesResult>;
export type SplitText = (
  text: string,
  language: TextSourceLanguage,
) => Promise<SplitResult>;
export type TranslateSentences = (
  sentences: string[],
  language: TextSourceLanguage,
) => Promise<TranslateResult>;

/**
 * Where a long job is, for its progress bar (e+ 2). Every number is work
 * actually finished (sentences split, translated, annotated, voiced), so
 * the bar never moves on its own:
 * - split: the text is being split (one call, no count yet);
 * - translate: `done` of `total` sentences translated;
 * - notes / audio: `done` of `total` sentences have notes / audio;
 *   `waitSeconds` when the speech service is busy and the next batch
 *   waits that long first (D39).
 */
export type Stage =
  | { stage: "split" }
  | {
      stage: "translate" | "notes" | "audio";
      done: number;
      total: number;
      waitSeconds?: number;
    };

/**
 * The whole job's progress, 0–100. Preparing a draft is splitting then
 * translating (the split counts once done); making a practice ready is
 * notes then audio, each half of the work.
 */
export function stagePercent(stage: Stage): number {
  if (stage.stage === "split") return 0;
  const part = stage.total > 0 ? stage.done / stage.total : 1;
  const percent =
    stage.stage === "translate"
      ? part
      : stage.stage === "notes"
        ? part / 2
        : 0.5 + part / 2;
  return Math.round(percent * 100);
}

export type PrepareDraftResult =
  | { ok: true; sentences: DraftSentence[] }
  | {
      ok: false;
      reason:
        | Exclude<SplitResult, { ok: true }>["reason"]
        | Exclude<TranslateResult, { ok: true }>["reason"]
        /** The server couldn't be reached, e.g. the site was just updated. */
        | "network";
    };

/**
 * The rules' split, here in the browser, when the server's can't be had
 * (D49): splitting never fails for want of the model or the server.
 */
function splitByRules(text: string, language: TextSourceLanguage): SplitResult {
  const sentences = splitSentences(text, language);
  if (sentences.length === 0) return { ok: false, reason: "empty" };
  if (sentences.length > PRACTICE_LIMITS.sentences) {
    return { ok: false, reason: "too-many" };
  }
  return { ok: true, sentences };
}

/**
 * Splits the text, then translates it TRANSLATE_BATCH sentences at a time,
 * reporting progress after each step. Stops at the first error.
 */
export async function prepareDraft(
  actions: { split: SplitText; translate: TranslateSentences },
  text: string,
  language: TextSourceLanguage,
  onStage: (stage: Stage) => void,
): Promise<PrepareDraftResult> {
  onStage({ stage: "split" });
  // A thrown call (a lost connection, a page from before a deploy) once
  // showed "no sentences found" (D49); the rules split instead.
  const split = await actions
    .split(text, language)
    .catch(() => splitByRules(text, language));
  if (!split.ok) return split;
  const source = split.sentences;
  const translations: string[] = [];
  onStage({ stage: "translate", done: 0, total: source.length });
  for (let start = 0; start < source.length; start += TRANSLATE_BATCH) {
    const batch = source.slice(start, start + TRANSLATE_BATCH);
    const result = await actions
      .translate(batch, language)
      .catch(() => ({ ok: false, reason: "network" }) as const);
    if (!result.ok) return result;
    translations.push(...result.translations);
    onStage({
      stage: "translate",
      done: translations.length,
      total: source.length,
    });
  }
  return {
    ok: true,
    sentences: source.map((line, i) =>
      language === "zh"
        ? { en: translations[i], zh: line }
        : { en: line, zh: translations[i] },
    ),
  };
}

type BatchFailure = { ok: false; reason: "failed" };

/**
 * Calls a batch action until done === total, reporting progress after
 * each batch. Stops on the first error, or if a batch makes no progress
 * (so it can never loop forever). `count` reads a result's progress.
 */
async function runBatches<R extends { ok: boolean }>(
  call: () => Promise<R>,
  count: (result: R) => { done: number; total: number } | null,
  onProgress: (done: number, total: number) => void,
): Promise<R | BatchFailure> {
  const failed: BatchFailure = { ok: false, reason: "failed" };
  let previous = -1;
  for (;;) {
    const result = await call().catch(() => null);
    if (!result) return failed;
    const counted = count(result);
    // A result without numbers can't show progress or loop.
    const progress =
      counted && Number.isFinite(counted.done) && Number.isFinite(counted.total)
        ? counted
        : null;
    if (progress) onProgress(progress.done, progress.total);
    if (!result.ok || !progress || progress.done >= progress.total) {
      return result;
    }
    if (progress.done <= previous) return failed;
    previous = progress.done;
  }
}

/**
 * How long to wait after the speech service says it's busy, before each
 * retry in turn (D39). Azure Speech's free tier takes 20 requests a
 * minute, so a long practice goes in waves; a retry that gets further
 * starts the waits over.
 */
export const BUSY_RETRY_SECONDS = [20, 30, 60, 60] as const;

const sleep = (seconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, seconds * 1000));

/**
 * Every sentence's audio, batch by batch (AUDIO_BATCH_SIZE per call).
 * When the service is busy, waits and tries again (BUSY_RETRY_SECONDS),
 * telling `onWait` how long first; gives up as "busy" after the last.
 */
export async function generateAllAudio(
  generate: GenerateAudio,
  practiceId: string,
  onProgress: (voiced: number, total: number) => void,
  {
    onWait = () => {},
    wait = sleep,
  }: {
    onWait?: (seconds: number) => void;
    wait?: (seconds: number) => Promise<void>;
  } = {},
): Promise<GenerateAudioResult> {
  let retries = 0;
  let best = -1;
  for (;;) {
    const result = await runBatches(
      () => generate(practiceId),
      (result) =>
        result.voiced !== undefined && result.total !== undefined
          ? { done: result.voiced, total: result.total }
          : null,
      onProgress,
    );
    if (result.ok || result.reason !== "busy") return result;
    const voiced = "voiced" in result ? (result.voiced ?? -1) : -1;
    if (voiced > best) {
      best = voiced;
      retries = 0;
    }
    const seconds = BUSY_RETRY_SECONDS[retries++];
    if (seconds === undefined) return result;
    onWait(seconds);
    await wait(seconds);
  }
}

/** The practice's notes, chunk by chunk (NOTES_CHUNK sentences per call). */
export function generateAllNotes(
  generateNotes: GenerateNotes,
  practiceId: string,
  onProgress: (annotated: number, total: number) => void,
): Promise<GenerateNotesResult> {
  return runBatches(
    () => generateNotes(practiceId),
    (result) =>
      result.ok ? { done: result.annotated, total: result.total } : null,
    onProgress,
  );
}

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
  practice: { id: string; notesReady: boolean; total: number },
  onStage: (stage: Stage) => void,
): Promise<GenerationResult> {
  const { id: practiceId, notesReady, total } = practice;
  // Show the step right away; the first batch takes a few seconds.
  onStage({ stage: notesReady ? "audio" : "notes", done: 0, total });
  if (!notesReady) {
    const notes = await generateAllNotes(
      actions.generateNotes,
      practiceId,
      (done, total) => onStage({ stage: "notes", done, total }),
    );
    if (!notes.ok) return { ok: false, stage: "notes", reason: notes.reason };
  }
  let voiced = { done: 0, total };
  const audio = await generateAllAudio(
    actions.generate,
    practiceId,
    (done, total) => {
      voiced = { done, total };
      onStage({ stage: "audio", ...voiced });
    },
    {
      onWait: (waitSeconds) =>
        onStage({ stage: "audio", ...voiced, waitSeconds }),
    },
  );
  return audio.ok
    ? { ok: true }
    : { ok: false, stage: "audio", reason: audio.reason };
}
