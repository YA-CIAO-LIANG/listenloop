"use server";

import { revalidatePath } from "next/cache";
import { getCreator } from "@/auth/creator";
import { getServerSupabase } from "@/auth/server";
import { meteredTranslate } from "@/lib/ai/metered";
import {
  cleanDraft,
  isTextSourceLanguage,
  PRACTICE_LIMITS,
  type DraftProblem,
  type DraftSentence,
  type PracticeDraft,
} from "@/lib/custom-practice/draft";
import { splitSentences } from "@/lib/custom-practice/split";
import { countChars } from "@/lib/usage";

export type PrepareResult =
  | { ok: true; sentences: DraftSentence[] }
  | {
      ok: false;
      reason:
        "unavailable" | "empty" | "too-long" | "too-many" | "limit" | "failed";
    };

/**
 * Splits the uploaded text into sentences and translates them: Chinese to
 * English (what's practiced), English to Chinese (the handout). Nothing
 * is saved; the learner reviews the result first.
 */
export async function prepareSentences(
  text: unknown,
  language: unknown,
): Promise<PrepareResult> {
  const creator = await getCreator();
  if (!creator) return { ok: false, reason: "unavailable" };
  if (typeof text !== "string" || !isTextSourceLanguage(language)) {
    return { ok: false, reason: "empty" };
  }
  if (countChars([text]) > PRACTICE_LIMITS.textChars) {
    return { ok: false, reason: "too-long" };
  }
  const source = splitSentences(text, language);
  if (source.length === 0) return { ok: false, reason: "empty" };
  if (source.length > PRACTICE_LIMITS.sentences) {
    return { ok: false, reason: "too-many" };
  }

  const fromChinese = language === "zh";
  const translated = await meteredTranslate(
    creator,
    source,
    fromChinese ? { from: "zh-Hant", to: "en" } : { from: "en", to: "zh-Hant" },
  );
  if (!translated.ok) return translated;
  return {
    ok: true,
    sentences: source.map((line, i) =>
      fromChinese
        ? { en: translated.value[i], zh: line }
        : { en: line, zh: translated.value[i] },
    ),
  };
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
  revalidatePath("/create");
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
