"use server";

import { revalidatePath } from "next/cache";
import { getCreator } from "@/auth/creator";
import { getServerSupabase } from "@/auth/server";
import type { MeteredFailure } from "@/lib/ai/metered";
import { cleanDraft, type DraftProblem } from "@/lib/custom-practice/draft";
import {
  badNotes,
  planEdit,
  type EditSentence,
} from "@/lib/custom-practice/edit";
import {
  joinNotes,
  translateCached,
  type SentenceNotes,
} from "@/lib/custom-practice/notes";
import { customPracticeId } from "@/lib/practice-material";

export type SaveEditResult =
  | {
      ok: true;
      version: number;
      /** What's left to make, for prepareForPractice. */
      notesReady: boolean;
      total: number;
    }
  | {
      ok: false;
      reason: "unavailable" | "not-found" | "conflict" | MeteredFailure;
    }
  | {
      ok: false;
      reason: "invalid";
      problem: DraftProblem | "notes";
      sentence?: number;
    };

/**
 * Saves an edit of one of the user's practices as its next version (e+ 9c,
 * D44, D45). Unchanged sentences keep their audio and notes; changed ones
 * without Chinese are translated here (cached by sentence, D43); their
 * notes and audio are made afterwards by the usual steps
 * (generatePracticeNotes, generatePracticeAudio), which skip what exists.
 * Only the author can save: the database function runs as the user.
 */
export async function savePracticeEdit(
  practiceId: unknown,
  input: unknown,
): Promise<SaveEditResult> {
  const creator = await getCreator();
  if (!creator) return { ok: false, reason: "unavailable" };
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, reason: "unavailable" };
  if (typeof practiceId !== "string") return { ok: false, reason: "not-found" };

  const { data: practice, error } = await supabase
    .from("practices")
    .select(
      "voice, version, source_language, practice_sentences(i, en, audio_path, notes)",
    )
    .eq("id", practiceId)
    .eq("user_id", creator.user.id)
    .maybeSingle();
  if (error) return { ok: false, reason: "failed" };
  if (!practice) return { ok: false, reason: "not-found" };

  const raw = (input ?? {}) as Record<string, unknown>;
  const list = Array.isArray(raw.sentences) ? raw.sentences : [];
  const cleaned = cleanDraft({
    title: raw.title,
    voice: raw.voice,
    sourceLanguage: practice.source_language,
    sentences: list,
  });
  if (!cleaned.ok) {
    const { problem, sentence } = cleaned;
    return { ok: false, reason: "invalid", problem, sentence };
  }
  const notesProblem = badNotes(list);
  if (notesProblem !== null) {
    return {
      ok: false,
      reason: "invalid",
      problem: "notes",
      sentence: notesProblem,
    };
  }
  if (raw.expectedVersion !== practice.version) {
    return { ok: false, reason: "conflict" };
  }
  const { title, voice } = cleaned.draft;
  const sentences: EditSentence[] = cleaned.draft.sentences.map((s, i) => ({
    ...s,
    notes: ((list[i] as { notes?: SentenceNotes | null })?.notes ??
      null) as SentenceNotes | null,
  }));

  const current = [...practice.practice_sentences].sort((a, b) => a.i - b.i);
  const plan = planEdit(
    { voice: practice.voice, sentences: current },
    {
      voice,
      sentences,
    },
  );
  if (plan.translate.length > 0) {
    const translated = await translateCached(
      creator,
      plan.translate.map((i) => plan.sentences[i].en),
      { from: "en", to: "zh-Hant" },
    );
    if (!translated.ok) return translated;
    for (const [k, i] of plan.translate.entries()) {
      plan.sentences[i].zh = translated.value[k];
    }
  }

  const notesReady = plan.sentences.every((s) => s.notes !== null);
  const joined = notesReady
    ? joinNotes(plan.sentences.map((s) => s.notes as SentenceNotes))
    : { vocab: [], grammar: [] };
  const { data: version, error: saveError } = await supabase.rpc(
    "save_practice_edit",
    {
      target: practiceId,
      expected_version: practice.version,
      new_title: title,
      new_voice: voice,
      new_sentences: plan.sentences,
      new_vocab: joined.vocab,
      new_grammar: joined.grammar,
      notes_ready: notesReady,
    },
  );
  if (saveError) {
    return {
      ok: false,
      reason: saveError.message.includes("version conflict")
        ? "conflict"
        : "failed",
    };
  }
  revalidatePath("/materials");
  revalidatePath(`/videos/${customPracticeId(practiceId)}`);
  return {
    ok: true,
    version: version as number,
    notesReady,
    total: plan.sentences.length,
  };
}
