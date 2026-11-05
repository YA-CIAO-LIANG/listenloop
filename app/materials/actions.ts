"use server";

import { revalidatePath } from "next/cache";
import { getCreator } from "@/auth/creator";
import { getServerSupabase } from "@/auth/server";
import type { MeteredFailure } from "@/lib/ai/metered";
import { parseVoiceId } from "@/lib/ai/types";
import { AUDIO_BATCH_SIZE, voiceSentences } from "@/lib/custom-practice/audio";
import {
  cleanDraft,
  isTextSourceLanguage,
  PRACTICE_LIMITS,
  type DraftProblem,
  type PracticeDraft,
} from "@/lib/custom-practice/draft";
import {
  annotateSome,
  TRANSLATE_BATCH,
  translateCached,
} from "@/lib/custom-practice/notes";
import { splitSentences } from "@/lib/custom-practice/split";
import { countChars } from "@/lib/usage";

export type SplitResult =
  | { ok: true; sentences: string[] }
  | {
      ok: false;
      reason: "unavailable" | "empty" | "too-long" | "too-many";
    };

/**
 * Splits the uploaded text into sentences, the first step of preparing a
 * draft; translateSentences then translates them a batch at a time, so
 * the page can show real progress (e+ 2). Nothing is saved; the learner
 * reviews the result first.
 */
export async function splitText(
  text: unknown,
  language: unknown,
): Promise<SplitResult> {
  const creator = await getCreator();
  if (!creator) return { ok: false, reason: "unavailable" };
  if (typeof text !== "string" || !isTextSourceLanguage(language)) {
    return { ok: false, reason: "empty" };
  }
  if (countChars([text]) > PRACTICE_LIMITS.textChars) {
    return { ok: false, reason: "too-long" };
  }
  const sentences = splitSentences(text, language);
  if (sentences.length === 0) return { ok: false, reason: "empty" };
  if (sentences.length > PRACTICE_LIMITS.sentences) {
    return { ok: false, reason: "too-many" };
  }
  return { ok: true, sentences };
}

export type TranslateResult =
  | { ok: true; translations: string[] }
  | { ok: false; reason: "unavailable" | "empty" | MeteredFailure };

/**
 * Translates up to TRANSLATE_BATCH split sentences of a text in `language`:
 * Chinese to English (what's practiced), English to Chinese (the handout).
 */
export async function translateSentences(
  sentences: unknown,
  language: unknown,
): Promise<TranslateResult> {
  const creator = await getCreator();
  if (!creator) return { ok: false, reason: "unavailable" };
  if (
    !Array.isArray(sentences) ||
    sentences.length === 0 ||
    sentences.length > TRANSLATE_BATCH ||
    !sentences.every((s) => typeof s === "string" && s.trim()) ||
    countChars(sentences) > PRACTICE_LIMITS.textChars ||
    !isTextSourceLanguage(language)
  ) {
    return { ok: false, reason: "empty" };
  }
  const translated = await translateCached(
    creator,
    sentences,
    language === "zh"
      ? { from: "zh-Hant", to: "en" }
      : { from: "en", to: "zh-Hant" },
  );
  return translated.ok
    ? { ok: true, translations: translated.value }
    : translated;
}

export type CreatePracticeResult =
  | { ok: true; id: string }
  | { ok: false; reason: "unavailable" | "failed" }
  | { ok: false; reason: "invalid"; problem: DraftProblem; sentence?: number };

/**
 * Saves a reviewed draft as the signed-in user's practice (private). Rows
 * are written with the user's own session, so row level security applies.
 */
export async function createPractice(
  input: unknown,
): Promise<CreatePracticeResult> {
  const creator = await getCreator();
  if (!creator) return { ok: false, reason: "unavailable" };
  const cleaned = cleanDraft(input);
  if (!cleaned.ok) {
    const { problem, sentence } = cleaned;
    return { ok: false, reason: "invalid", problem, sentence };
  }
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, reason: "unavailable" };

  const id = await savePractice(supabase, creator.user.id, cleaned.draft);
  if (!id) return { ok: false, reason: "failed" };
  revalidatePath("/materials");
  return { ok: true, id };
}

async function savePractice(
  supabase: NonNullable<Awaited<ReturnType<typeof getServerSupabase>>>,
  userId: string,
  draft: PracticeDraft,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("practices")
    .insert({
      user_id: userId,
      title: draft.title,
      source_language: draft.sourceLanguage,
      voice: draft.voice,
    })
    .select("id")
    .single();
  if (error || !data) return null;

  const { error: sentencesError } = await supabase
    .from("practice_sentences")
    .insert(
      draft.sentences.map((sentence, i) => ({
        practice_id: data.id,
        i,
        en: sentence.en,
        zh: sentence.zh,
      })),
    );
  if (sentencesError) {
    // No half-made practice: removing it removes any sentences too.
    await supabase.from("practices").delete().eq("id", data.id);
    return null;
  }
  return data.id;
}

export type GenerateAudioResult =
  | { ok: true; voiced: number; total: number }
  | {
      ok: false;
      reason: "unavailable" | "not-found" | MeteredFailure;
      voiced?: number;
      total?: number;
    };

/**
 * Generates audio for the next few sentences of one of the user's
 * practices that don't have it yet (AUDIO_BATCH_SIZE per call, so each
 * call stays short). The browser calls it again until voiced === total;
 * a run cut off halfway simply continues next time.
 */
export async function generatePracticeAudio(
  practiceId: unknown,
): Promise<GenerateAudioResult> {
  const creator = await getCreator();
  if (!creator) return { ok: false, reason: "unavailable" };
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, reason: "unavailable" };
  if (typeof practiceId !== "string") return { ok: false, reason: "not-found" };

  // Only their own: others' public practices are readable too (D30).
  const { data: practice, error } = await supabase
    .from("practices")
    .select("voice, practice_sentences(i, en, audio_path)")
    .eq("id", practiceId)
    .eq("user_id", creator.user.id)
    .maybeSingle();
  if (error) return { ok: false, reason: "failed" };
  const voice = practice?.voice ? parseVoiceId(practice.voice) : null;
  if (!practice || !voice) return { ok: false, reason: "not-found" };

  const sentences = [...practice.practice_sentences].sort((a, b) => a.i - b.i);
  const total = sentences.length;
  const missing = sentences.filter((s) => !s.audio_path);
  const batch = await voiceSentences(
    creator,
    voice,
    missing.slice(0, AUDIO_BATCH_SIZE),
  );

  for (const { i, path } of batch.done) {
    const { error: updateError } = await supabase
      .from("practice_sentences")
      .update({ audio_path: path })
      .eq("practice_id", practiceId)
      .eq("i", i);
    if (updateError) return { ok: false, reason: "failed" };
  }
  const voiced = total - missing.length + batch.done.length;
  if (voiced === total) revalidatePath("/materials");
  if (batch.stopped) {
    return { ok: false, reason: batch.stopped, voiced, total };
  }
  return { ok: true, voiced, total };
}

export type GenerateNotesResult =
  | { ok: true; annotated: number; total: number }
  | { ok: false; reason: "unavailable" | "not-found" | MeteredFailure };

/**
 * Makes the vocabulary and grammar notes for one of the user's practices
 * from its saved (already reviewed) English, so the notes match the final
 * sentences: one chunk (NOTES_CHUNK sentences) per call, each cached, so
 * each call stays short and the page can show progress. The browser calls
 * again until annotated === total; the last call saves the notes. Does
 * nothing if they exist; a retry after a failure only redoes what's missing.
 */
export async function generatePracticeNotes(
  practiceId: unknown,
): Promise<GenerateNotesResult> {
  const creator = await getCreator();
  if (!creator) return { ok: false, reason: "unavailable" };
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, reason: "unavailable" };
  if (typeof practiceId !== "string") return { ok: false, reason: "not-found" };

  // Only their own: others' public practices are readable too (D30).
  const { data: practice, error } = await supabase
    .from("practices")
    .select("notes_generated_at, practice_sentences(i, en)")
    .eq("id", practiceId)
    .eq("user_id", creator.user.id)
    .maybeSingle();
  if (error) return { ok: false, reason: "failed" };
  if (!practice) return { ok: false, reason: "not-found" };
  const total = practice.practice_sentences.length;
  if (practice.notes_generated_at) {
    return { ok: true, annotated: total, total };
  }

  const sentences = [...practice.practice_sentences]
    .sort((a, b) => a.i - b.i)
    .map((s) => s.en);
  const result = await annotateSome(creator, sentences, 1);
  if (!result.ok) return result;
  const { annotated, notes } = result.value;
  if (!notes) return { ok: true, annotated, total };

  const { data: updated, error: updateError } = await supabase
    .from("practices")
    .update({
      vocab: notes.vocab,
      grammar: notes.grammar,
      notes_generated_at: new Date().toISOString(),
    })
    .eq("id", practiceId)
    .select("id");
  if (updateError || !updated?.length) return { ok: false, reason: "failed" };
  revalidatePath("/materials");
  return { ok: true, annotated: total, total };
}
