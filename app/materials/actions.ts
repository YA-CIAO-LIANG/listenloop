"use server";

import {
  cleanSubtitle,
  describeInput,
  subtitleFromModel,
} from "@/lib/custom-practice/subtitle";
import { keepTypedTitles } from "@/lib/titles";
import { officialColumns } from "@/lib/material-admin";
import { getAdminSupabase } from "@/auth/admin";
import type { UsageBlock } from "@/lib/usage";
import { revalidatePath } from "next/cache";
import { creationAllowed } from "@/auth/creation-quota";
import { getCreator } from "@/auth/creator";
import { logEvent } from "@/auth/events";
import { allowAction } from "@/auth/rate-limit";
import { getServerSupabase } from "@/auth/server";
import { composeBudget, describeBudget } from "@/lib/ai/budgets";
import { meteredLanguage, type MeteredFailure } from "@/lib/ai/metered";
import {
  checkGeneratedText,
  compositionPrompt,
  lengthSeconds,
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
  parseStoredNotes,
  type StoredNotes,
  segmentLines,
  TRANSLATE_BATCH,
  translateCached,
} from "@/lib/custom-practice/notes";
import { can, planFor, type PlanBlock, type PlanCheck } from "@/lib/plans";
import { countChars } from "@/lib/usage";
import {
  isDialogue,
  speakerLines,
  type Speaker,
} from "@/lib/custom-practice/speakers";
import { customPracticeId } from "@/lib/practice-material";

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
  if (!creator || !(await creationAllowed(creator)).ok) {
    return { ok: false, reason: "unavailable" };
  }
  if (typeof text !== "string" || !isTextSourceLanguage(language)) {
    return { ok: false, reason: "empty" };
  }
  const chars = countChars([text]);
  if (chars > PRACTICE_LIMITS.textChars) {
    return { ok: false, reason: "too-long", max: PRACTICE_LIMITS.textChars };
  }
  // The plan's own limit (D54, D72).
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

/** Which allowance stopped an AI step, when one did (D77). */
type LimitDetail = { limit?: UsageBlock };

export type TranslateResult =
  | { ok: true; translations: string[] }
  | ({
      ok: false;
      reason: "unavailable" | "empty" | MeteredFailure;
    } & LimitDetail);

/**
 * Translates up to TRANSLATE_BATCH split sentences of a text in `language`:
 * Chinese to English (what's practiced), English to Chinese (the handout).
 */
export async function translateSentences(
  sentences: unknown,
  language: unknown,
): Promise<TranslateResult> {
  const creator = await getCreator();
  if (!creator || !(await creationAllowed(creator)).ok) {
    return { ok: false, reason: "unavailable" };
  }
  if (!(await allowAction("ai", creator.user.id))) {
    return { ok: false, reason: "busy" };
  }
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
  | ({ ok: false; reason: "unavailable" | MeteredFailure } & {
      usage?: UsageBlock;
    })
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
  if (!(await allowAction("ai", creator.user.id))) {
    return { ok: false, reason: "busy" };
  }
  // The titles as typed or reviewed (D83): kept exactly (ends trimmed);
  // the legacy title is the English one, else the Chinese one.
  const raw = (input ?? {}) as Record<string, unknown>;
  // An older client sends one `title`: it's a title in its own language.
  const legacy = typeof raw.title === "string" ? raw.title.trim() : "";
  const legacyHan = /\p{Script=Han}/u.test(legacy);
  const titles = keepTypedTitles(
    { en: raw.titleEn, zh: raw.titleZh },
    { en: legacyHan ? "" : legacy, zh: legacyHan ? legacy : "" },
  );
  if (
    [...titles.en].length > PRACTICE_LIMITS.titleChars ||
    [...titles.zh].length > PRACTICE_LIMITS.titleChars
  ) {
    return { ok: false, reason: "invalid", problem: "title" };
  }
  const subtitle = cleanSubtitle(raw.subtitle);
  const cleaned = cleanDraft(
    titles.en || titles.zh ? { ...raw, title: titles.en || titles.zh } : input,
  );
  if (!cleaned.ok) {
    const { problem, sentence } = cleaned;
    return { ok: false, reason: "invalid", problem, sentence };
  }
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, reason: "unavailable" };
  const allowed = await creationAllowed(creator);
  const length = can(planFor(creator.user), {
    kind: "practice-chars",
    chars: countChars(cleaned.draft.sentences.map((s) => s.en)),
  });
  if (!allowed.ok || !length.ok) {
    const block = !allowed.ok
      ? allowed
      : (length as Extract<PlanCheck, { ok: false }>);
    return {
      ok: false,
      reason: "plan",
      limit: block.limit,
      max: block.max,
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
    if (!translated.ok) {
      return { ok: false, reason: translated.reason, usage: translated.limit };
    }
    let next = 0;
    draft.sentences = draft.sentences.map((sentence) =>
      sentence.zh ? sentence : { ...sentence, zh: translated.value[next++] },
    );
  }

  // Where AI-written text belongs (D57); checked against the categories.
  const meta = parseMaterialMeta((input as { meta?: unknown } | null)?.meta);
  const id = await savePractice(supabase, creator.user.id, draft, meta, {
    titleEn: titles.en,
    titleZh: titles.zh,
    subtitle,
  });
  if (!id) return { ok: false, reason: "failed" };
  // A new official material (D80): admins only, an official draft from
  // the start, marked with the secret key (users can't mark official).
  if (
    (input as { official?: unknown } | null)?.official === true &&
    creator.user.role === "admin"
  ) {
    await getAdminSupabase()
      ?.from("practices")
      .update(officialColumns("draft"))
      .eq("id", id);
    revalidatePath("/admin/official");
  }
  await logEvent(creator.user.id, {
    type: "practice_create",
    videoId: customPracticeId(id),
  });
  revalidatePath("/materials");
  return { ok: true, id };
}

async function savePractice(
  supabase: NonNullable<Awaited<ReturnType<typeof getServerSupabase>>>,
  userId: string,
  draft: PracticeDraft,
  meta: MaterialMeta | null,
  labels: { titleEn: string; titleZh: string; subtitle: string | null },
): Promise<string | null> {
  const { data, error } = await supabase
    .from("practices")
    .insert({
      user_id: userId,
      title: draft.title,
      // Both titles (D83), each as typed or written; null when empty.
      title_en: labels.titleEn || null,
      title_zh: labels.titleZh || null,
      subtitle: labels.subtitle,
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
  | ({
      ok: false;
      reason: "unavailable" | "not-found" | MeteredFailure;
      voiced?: number;
      total?: number;
    } & LimitDetail);

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
  if (!(await allowAction("ai", creator.user.id))) {
    return { ok: false, reason: "busy" };
  }
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
    return {
      ok: false,
      reason: batch.stopped,
      voiced,
      total,
      limit: batch.limit,
    };
  }
  return { ok: true, voiced, total };
}

export type GenerateNotesResult =
  | { ok: true; annotated: number; total: number }
  | ({
      ok: false;
      reason: "unavailable" | "not-found" | MeteredFailure;
    } & LimitDetail);

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
  if (!(await allowAction("ai", creator.user.id))) {
    return { ok: false, reason: "busy" };
  }
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
  const stored = rows.map((row) => parseStoredNotes(row.notes, row.en));
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

  const joined = joinNotes(notes as StoredNotes[]);
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
  | {
      ok: true;
      /** Typed ones kept exactly; written ones fill the rest (D83). */
      titleEn: string;
      titleZh: string;
      subtitle: string;
      text: string;
    }
  | { ok: false; reason: "tooLong"; max?: number }
  | ({
      ok: false;
      reason: "unavailable" | "invalid" | MeteredFailure;
    } & LimitDetail);

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
  if (!creator || !(await creationAllowed(creator)).ok) {
    return { ok: false, reason: "unavailable" };
  }
  if (!(await allowAction("ai", creator.user.id))) {
    return { ok: false, reason: "busy" };
  }
  const request = parseGenerationRequest(input);
  if (!request) return { ok: false, reason: "invalid" };
  // The plan's longest practice (D94).
  const long = can(planFor(creator.user), {
    kind: "practice-seconds",
    seconds: lengthSeconds(request.length, request.seconds),
  });
  if (!long.ok) return { ok: false, reason: "tooLong", max: long.max };
  const prompt = compositionPrompt(request);
  const result = await meteredLanguage(creator, composeBudget(prompt), () =>
    creator.providers.language.compose(prompt),
  );
  if (!result.ok) return result;
  const text = checkGeneratedText(result.value, prompt.words);
  if (!text) return { ok: false, reason: "failed" };
  // The learner's titles are kept exactly; the model's fill only the
  // language left empty (D81, D83).
  const titles = keepTypedTitles(
    { en: request.titleEn, zh: request.titleZh },
    { en: text.title, zh: text.titleZh },
  );
  return {
    ok: true,
    titleEn: titles.en,
    titleZh: titles.zh,
    subtitle: text.subtitle,
    text: text.text,
  };
}

export type DescribeDraftResult =
  | { ok: true; titleEn: string; titleZh: string; subtitle: string }
  | ({
      ok: false;
      reason: "unavailable" | "invalid" | MeteredFailure;
    } & LimitDetail);

/**
 * The titles and subtitle of a draft from pasted text (D83), in one call
 * after it's split and translated: the language the learner typed is
 * kept exactly, the other one and the subtitle are written. With both
 * titles typed, only the subtitle is new.
 */
export async function describeDraft(
  input: unknown,
): Promise<DescribeDraftResult> {
  const creator = await getCreator();
  if (!creator || !(await creationAllowed(creator)).ok) {
    return { ok: false, reason: "unavailable" };
  }
  if (!(await allowAction("ai", creator.user.id))) {
    return { ok: false, reason: "busy" };
  }
  const raw = (input ?? {}) as Record<string, unknown>;
  const sentences = Array.isArray(raw.sentences)
    ? raw.sentences.filter((s): s is string => typeof s === "string")
    : [];
  const typed = keepTypedTitles({ en: raw.titleEn, zh: raw.titleZh }, {});
  if (
    sentences.length === 0 ||
    [...typed.en].length > PRACTICE_LIMITS.titleChars ||
    [...typed.zh].length > PRACTICE_LIMITS.titleChars
  ) {
    return { ok: false, reason: "invalid" };
  }
  const describe = {
    ...describeInput(typed.en || typed.zh, sentences),
    ...(typed.en ? { titleEn: typed.en } : {}),
    ...(typed.zh ? { titleZh: typed.zh } : {}),
  };
  const result = await meteredLanguage(creator, describeBudget(describe), () =>
    creator.providers.language.describe(describe),
  );
  if (!result.ok) return result;
  const written = (result.value ?? {}) as {
    titleEn?: unknown;
    titleZh?: unknown;
  };
  const titles = keepTypedTitles(typed, {
    en:
      typeof written.titleEn === "string"
        ? written.titleEn.replace(/\s+/g, " ")
        : "",
    zh:
      typeof written.titleZh === "string"
        ? written.titleZh.replace(/\s+/g, " ")
        : "",
  });
  return {
    ok: true,
    titleEn: titles.en.slice(0, PRACTICE_LIMITS.titleChars),
    titleZh: titles.zh.slice(0, PRACTICE_LIMITS.titleChars),
    subtitle: subtitleFromModel(result.value) ?? "",
  };
}
