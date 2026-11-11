"use server";

import type { UsageBlock } from "@/lib/usage";
import { can, planFor, type PlanBlock } from "@/lib/plans";
import { countChars } from "@/lib/usage";
import { revalidatePath } from "next/cache";
import { getCreator } from "@/auth/creator";
import { logEvent } from "@/auth/events";
import { allowAction } from "@/auth/rate-limit";
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
  type StoredNotes,
} from "@/lib/custom-practice/notes";
import { cleanSubtitle } from "@/lib/custom-practice/subtitle";
import { PRACTICE_LIMITS } from "@/lib/custom-practice/draft";
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
      /** For limit: which allowance ran out (D77). */
      usage?: UsageBlock;
    }
  | {
      ok: false;
      reason: "invalid";
      problem: DraftProblem | "notes";
      sentence?: number;
    }
  | { ok: false; reason: "plan"; limit: PlanBlock["limit"]; max?: number };

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
  if (!(await allowAction("ai", creator.user.id))) {
    return { ok: false, reason: "busy" };
  }
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, reason: "unavailable" };
  if (typeof practiceId !== "string") return { ok: false, reason: "not-found" };

  const { data: practice, error } = await supabase
    .from("practices")
    .select(
      "voice, voice_b, version, source_language, youtube_id, source_audio_path, practice_sentences(i, en, audio_path, notes, speaker)",
    )
    .eq("id", practiceId)
    .eq("user_id", creator.user.id)
    .maybeSingle();
  if (error) return { ok: false, reason: "failed" };
  // A YouTube practice or a recording can't be edited (D97, D130): its
  // times come from the video or the recording.
  if (!practice || practice.youtube_id || practice.source_audio_path) {
    return { ok: false, reason: "not-found" };
  }

  const raw = (input ?? {}) as Record<string, unknown>;
  const list = Array.isArray(raw.sentences) ? raw.sentences : [];
  // Both titles and the subtitle (D83), each kept as typed (ends trimmed);
  // an older client sends only `title`, and its titles stay as they were.
  const labels = editLabels(raw);
  if (labels === "invalid") {
    return { ok: false, reason: "invalid", problem: "title" };
  }
  const cleaned = cleanDraft({
    title: labels ? labels.title_en || labels.title_zh : raw.title,
    voice: raw.voice,
    voiceB: raw.voiceB,
    sourceLanguage: practice.source_language,
    sentences: list,
  });
  if (!cleaned.ok) {
    const { problem, sentence } = cleaned;
    return { ok: false, reason: "invalid", problem, sentence };
  }
  // The plan's characters per practice (D72) apply to an edit too.
  const tooLong = can(planFor(creator.user), {
    kind: "practice-chars",
    chars: countChars(cleaned.draft.sentences.map((s) => s.en)),
  });
  if (!tooLong.ok) {
    return {
      ok: false,
      reason: "plan",
      limit: tooLong.limit,
      max: tooLong.max,
    };
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
  const { title, voice, voiceB } = cleaned.draft;
  const sentences: EditSentence[] = cleaned.draft.sentences.map((s, i) => ({
    ...s,
    notes: ((list[i] as { notes?: StoredNotes | null })?.notes ??
      null) as StoredNotes | null,
  }));

  const current = [...practice.practice_sentences].sort((a, b) => a.i - b.i);
  const plan = planEdit(
    { voice: practice.voice, voiceB: practice.voice_b, sentences: current },
    { voice, voiceB: voiceB ?? null, sentences },
  );
  if (plan.translate.length > 0) {
    const translated = await translateCached(
      creator,
      plan.translate.map((i) => plan.sentences[i].en),
      { from: "en", to: "zh-Hant" },
    );
    if (!translated.ok) {
      return { ok: false, reason: translated.reason, usage: translated.limit };
    }
    for (const [k, i] of plan.translate.entries()) {
      plan.sentences[i].zh = translated.value[k];
    }
  }

  const notesReady = plan.sentences.every((s) => s.notes !== null);
  const joined = notesReady
    ? joinNotes(plan.sentences.map((s) => s.notes as StoredNotes))
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
      new_voice_b: voiceB,
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
  if (labels) {
    const { error: labelError } = await supabase
      .from("practices")
      .update(labels)
      .eq("id", practiceId)
      .eq("user_id", creator.user.id);
    if (labelError) return { ok: false, reason: "failed" };
  }
  revalidatePath("/materials");
  revalidatePath(`/videos/${customPracticeId(practiceId)}`);
  await logEvent(creator.user.id, {
    type: "practice_edit",
    videoId: customPracticeId(practiceId),
  });
  return {
    ok: true,
    version: version as number,
    notesReady,
    total: plan.sentences.length,
  };
}

type EditLabels = {
  title_en: string | null;
  title_zh: string | null;
  subtitle: string | null;
};

/**
 * The titles and subtitle from an edit (D83): at least one title, each
 * within the title limit; null when the client sent neither title field.
 */
function editLabels(
  raw: Record<string, unknown>,
): EditLabels | "invalid" | null {
  if (!("titleEn" in raw) && !("titleZh" in raw)) return null;
  const clean = (value: unknown) =>
    typeof value === "string" && value.trim() ? value.trim() : null;
  const en = clean(raw.titleEn);
  const zh = clean(raw.titleZh);
  const tooLong = (value: string | null) =>
    value !== null && [...value].length > PRACTICE_LIMITS.titleChars;
  if ((!en && !zh) || tooLong(en) || tooLong(zh)) return "invalid";
  return { title_en: en, title_zh: zh, subtitle: cleanSubtitle(raw.subtitle) };
}
