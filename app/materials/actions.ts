"use server";

import { revalidatePath } from "next/cache";
import { getCreator } from "@/auth/creator";
import { logEvent } from "@/auth/events";
import { getServerSupabase } from "@/auth/server";
import { composeBudget } from "@/lib/ai/budgets";
import { meteredLanguage, type MeteredFailure } from "@/lib/ai/metered";
import {
  checkGeneratedText,
  compositionPrompt,
  parseGenerationRequest,
  parseMaterialMeta,
  type MaterialMeta,
} from "@/lib/custom-practice/generation";
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
  annotateMissing,
  joinNotes,
  parseSentenceNotes,
  type SentenceNotes,
  segmentLines,
  TRANSLATE_BATCH,
  translateCached,
} from "@/lib/custom-practice/notes";
import { can, needsCount, planFor, type PlanBlock } from "@/lib/plans";
import { countChars } from "@/lib/usage";
import {
  isDialogue,
  speakerLines,
  type Speaker,
} from "@/lib/custom-practice/speakers";
import { customPracticeId } from "@/lib/practice-material";
import { usagePeriodStarts } from "@/lib/usage-report";

export type SplitResult =
  | {
      ok: true;
      sentences: string[];
      /** Each sentence's speaker, for a two-voice dialogue (D57). */
      speakers?: Speaker[];
    }
  | {
      ok: false;
      reason: "unavailable" | "empty" | "too-long" | "too-many";
      /** For too-long: the most characters allowed (the plan's or the service's). */
      max?: number;
    };

/**
 * Splits the uploaded text into sentences by meaning (D35), the first
 * step of preparing a draft; translateSentences then translates them a batch at a time, so
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
  const chars = countChars([text]);
  if (chars > PRACTICE_LIMITS.textChars) {
    return { ok: false, reason: "too-long", max: PRACTICE_LIMITS.textChars };
  }
  // The plan's own limit (D54); unlimited today.
  const allowed = can(planFor(creator.user), { kind: "practice-chars", chars });
  if (!allowed.ok) return { ok: false, reason: "too-long", max: allowed.max };
  // "A:" and "B:" labels pick the voice and aren't read aloud (D57).
  const lines = speakerLines(text);
  const pieces = await segmentLines(
    creator,
    lines.map((line) => line.text),
    language,
  );
  const sentences = pieces.flat();
  if (sentences.length === 0) return { ok: false, reason: "empty" };
  if (sentences.length > PRACTICE_LIMITS.sentences) {
    return { ok: false, reason: "too-many" };
  }
  return isDialogue(lines)
    ? {
        ok: true,
        sentences,
        speakers: lines.flatMap((line, i) =>
          pieces[i].map(() => line.speaker ?? 0),
        ),
      }
    : { ok: true, sentences };
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
  | { ok: false; reason: "unavailable" | MeteredFailure }
  | { ok: false; reason: "plan"; limit: PlanBlock["limit"]; max?: number }
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
  const plan = planFor(creator.user);
  // Counted only when the plan has a monthly limit (D54).
  const createdThisMonth = needsCount(plan, "create-practice")
    ? await countCreatedThisMonth(supabase, creator.user.id)
    : 0;
  const allowed = can(plan, { kind: "create-practice", createdThisMonth });
  if (!allowed.ok) {
    return {
      ok: false,
      reason: "plan",
      limit: allowed.limit,
      max: allowed.max,
    };
  }

  // Sentences split or added in review have no Chinese yet: translate
  // them (e+ 4, D35) so every handout line has its translation.
  const draft = cleaned.draft;
  const missing = draft.sentences.filter((sentence) => !sentence.zh);
  if (missing.length > 0) {
    const translated = await translateCached(
      creator,
      missing.map((sentence) => sentence.en),
      { from: "en", to: "zh-Hant" },
    );
    if (!translated.ok) return translated;
    let next = 0;
    draft.sentences = draft.sentences.map((sentence) =>
      sentence.zh ? sentence : { ...sentence, zh: translated.value[next++] },
    );
  }

  // Where AI-written text belongs (D57); checked against the categories.
  const meta = parseMaterialMeta((input as { meta?: unknown } | null)?.meta);
  const id = await savePractice(supabase, creator.user.id, draft, meta);
  if (!id) return { ok: false, reason: "failed" };
  await logEvent(creator.user.id, {
    type: "practice_create",
    videoId: customPracticeId(id),
  });
  revalidatePath("/materials");
  return { ok: true, id };
}

/** The user's practices created since the start of this month (Taiwan time). */
async function countCreatedThisMonth(
  supabase: NonNullable<Awaited<ReturnType<typeof getServerSupabase>>>,
  userId: string,
): Promise<number> {
  const { monthStart } = usagePeriodStarts(new Date());
  const { count } = await supabase
    .from("practices")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", monthStart);
  return count ?? 0;
}

async function savePractice(
  supabase: NonNullable<Awaited<ReturnType<typeof getServerSupabase>>>,
  userId: string,
  draft: PracticeDraft,
  meta: MaterialMeta | null,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("practices")
    .insert({
      user_id: userId,
      title: draft.title,
      source_language: draft.sourceLanguage,
      voice: draft.voice,
      voice_b: draft.voiceB ?? null,
      ...(meta
        ? {
            category: meta.category,
            scenario: meta.scenario,
            level: meta.level,
            exam: meta.exam,
            exam_target: meta.examTarget,
          }
        : {}),
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
        speaker: sentence.speaker ?? null,
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
    .select("voice, voice_b, practice_sentences(i, en, audio_path, speaker)")
    .eq("id", practiceId)
    .eq("user_id", creator.user.id)
    .maybeSingle();
  if (error) return { ok: false, reason: "failed" };
  const voice = practice?.voice ? parseVoiceId(practice.voice) : null;
  if (!practice || !voice) return { ok: false, reason: "not-found" };

  const sentences = [...practice.practice_sentences].sort((a, b) => a.i - b.i);
  const total = sentences.length;
  const missing = sentences.filter((s) => !s.audio_path);
  // In a dialogue, speaker B's sentences use the second voice (D57).
  const voiceB = practice.voice_b ? parseVoiceId(practice.voice_b) : null;
  const batch = await voiceSentences(
    creator,
    voice,
    missing.slice(0, AUDIO_BATCH_SIZE).map((s) => ({
      i: s.i,
      en: s.en,
      ...(s.speaker === 1 && voiceB ? { voice: voiceB } : {}),
    })),
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
 * sentences. Each sentence keeps its own notes (practice_sentences.notes,
 * D43), cached by its text, so a sentence annotated before (here or in
 * any practice) costs nothing. One model call (NOTES_CHUNK sentences) per
 * server call keeps each short and lets the page show progress; the
 * browser calls again until annotated === total. Once every sentence has
 * notes, they're joined into the practice's vocab and grammar. Does
 * nothing if that's done; a retry only redoes what's missing.
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
    .select("notes_generated_at, practice_sentences(i, en, notes)")
    .eq("id", practiceId)
    .eq("user_id", creator.user.id)
    .maybeSingle();
  if (error) return { ok: false, reason: "failed" };
  if (!practice) return { ok: false, reason: "not-found" };
  const total = practice.practice_sentences.length;
  if (practice.notes_generated_at) {
    return { ok: true, annotated: total, total };
  }

  const rows = [...practice.practice_sentences].sort((a, b) => a.i - b.i);
  const stored = rows.map((row) => parseSentenceNotes(row.notes));
  const result = await annotateMissing(
    creator,
    rows.map((row) => row.en),
    stored,
    1,
  );
  if (!result.ok) return result;
  const notes = result.value;

  for (const [k, row] of rows.entries()) {
    if (stored[k] || !notes[k]) continue;
    const { error: saveError } = await supabase
      .from("practice_sentences")
      .update({ notes: notes[k] })
      .eq("practice_id", practiceId)
      .eq("i", row.i);
    if (saveError) return { ok: false, reason: "failed" };
  }
  const annotated = notes.filter(Boolean).length;
  if (annotated < total) return { ok: true, annotated, total };

  const joined = joinNotes(notes as SentenceNotes[]);
  const { data: updated, error: updateError } = await supabase
    .from("practices")
    .update({
      vocab: joined.vocab,
      grammar: joined.grammar,
      notes_generated_at: new Date().toISOString(),
    })
    .eq("id", practiceId)
    .select("id");
  if (updateError || !updated?.length) return { ok: false, reason: "failed" };
  revalidatePath("/materials");
  return { ok: true, annotated: total, total };
}

export type GenerateTextResult =
  | { ok: true; title: string; text: string }
  | { ok: false; reason: "unavailable" | "invalid" | MeteredFailure };

/**
 * Writes new English practice text with the language model (e+ 5, D36)
 * for the learner to review and edit before splitting. Admins only, like
 * everything that calls a paid API; the worst-case cost is reserved
 * against the daily allowance first (D38). Never cached: each request is new.
 */
export async function generatePracticeText(
  input: unknown,
): Promise<GenerateTextResult> {
  const creator = await getCreator();
  if (!creator) return { ok: false, reason: "unavailable" };
  const request = parseGenerationRequest(input);
  if (!request) return { ok: false, reason: "invalid" };
  const prompt = compositionPrompt(request);
  const result = await meteredLanguage(creator, composeBudget(prompt), () =>
    creator.providers.language.compose(prompt),
  );
  if (!result.ok) return result;
  const text = checkGeneratedText(result.value, prompt.words);
  return text ? { ok: true, ...text } : { ok: false, reason: "failed" };
}
