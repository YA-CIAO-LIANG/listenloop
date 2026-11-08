import type { SupabaseClient } from "@supabase/supabase-js";
import { parseVoiceId, type VoiceAccent } from "@/lib/ai/types";
import { voiceSentences } from "@/lib/custom-practice/audio";
import type { MaterialMeta } from "@/lib/custom-practice/generation";
import {
  annotateMissing,
  joinNotes,
  segmentLines,
  TRANSLATE_BATCH,
  translateCached,
  type SentenceNotes,
} from "@/lib/custom-practice/notes";
import { speakerLines } from "@/lib/custom-practice/speakers";
import { officialColumns } from "@/lib/material-admin";
import { officialProblems, type OfficialProblem } from "@/lib/official-check";
import type { Database } from "@/lib/supabase/database.types";

/**
 * The shared second half of making an official material (D99, D100):
 * once the text is written, split it, translate it, annotate it, save
 * it, voice it, and check it; publish it if nothing is missing, or leave
 * it a draft. Used by the official and news batch scripts.
 */
export type PipelineDeps = Parameters<typeof segmentLines>[0] &
  Parameters<typeof voiceSentences>[0];

export type WrittenMaterial = {
  title: string;
  titleZh: string;
  subtitle: string;
  /** English text; a dialogue's lines start with "A:" / "B:". */
  text: string;
  format: "dialogue" | "monologue";
  accent: VoiceAccent;
  meta: MaterialMeta;
  /** A news material's source (D100), shown as "rewritten from". */
  source?: { name: string; title: string; url: string };
};

export type PipelineResult =
  | {
      ok: true;
      id: string;
      published: boolean;
      problems: OfficialProblem[];
      sentences: number;
    }
  | { ok: false; stage: string; reason: string };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function buildOfficial(
  admin: SupabaseClient<Database>,
  deps: PipelineDeps,
  ownerId: string,
  written: WrittenMaterial,
): Promise<PipelineResult> {
  const dialogue = written.format === "dialogue";
  // 1. Split (labels off), keeping each sentence's speaker.
  const lines = speakerLines(written.text);
  const pieces = await segmentLines(
    deps,
    lines.map((l) => l.text),
    "en",
  );
  const sentences = pieces.flat();
  const speakers = lines.flatMap((line, i) =>
    pieces[i].map(() => (dialogue ? (line.speaker ?? 0) : null)),
  );

  // 2. Translate, a batch at a time.
  const zh: string[] = [];
  for (let start = 0; start < sentences.length; start += TRANSLATE_BATCH) {
    const batch = await translateCached(
      deps,
      sentences.slice(start, start + TRANSLATE_BATCH),
      { from: "en", to: "zh-Hant" },
    );
    if (!batch.ok)
      return { ok: false, stage: "translate", reason: batch.reason };
    zh.push(...batch.value);
  }

  // 3. Notes for every sentence.
  const annotated = await annotateMissing(
    deps,
    sentences,
    sentences.map(() => null),
    Infinity,
  );
  if (!annotated.ok) {
    return { ok: false, stage: "notes", reason: annotated.reason };
  }
  const notes = annotated.value.map(
    (n) => n ?? { vocab: [], grammar: [] },
  ) as SentenceNotes[];
  const joined = joinNotes(notes);

  // 4. Save it as an official draft.
  const voice = `${written.accent}-female`;
  const voiceB = dialogue ? `${written.accent}-male` : null;
  const { meta } = written;
  const { data: practice, error } = await admin
    .from("practices")
    .insert({
      user_id: ownerId,
      title: written.title,
      title_en: written.title,
      title_zh: written.titleZh || null,
      subtitle: written.subtitle || null,
      source_language: "en",
      voice,
      voice_b: voiceB,
      ...officialColumns("draft"),
      category: meta.category,
      scenario: meta.scenario,
      level: meta.level,
      exam: meta.exam,
      exam_target: meta.examTarget,
      vocab: joined.vocab,
      grammar: joined.grammar,
      notes_generated_at: new Date().toISOString(),
      ...(written.source
        ? {
            source_name: written.source.name,
            source_title: written.source.title.slice(0, 300),
            source_url: written.source.url,
          }
        : {}),
    })
    .select("id")
    .single();
  if (error || !practice) {
    return { ok: false, stage: "save", reason: error?.message ?? "no row" };
  }
  const { error: sentencesError } = await admin
    .from("practice_sentences")
    .insert(
      sentences.map((en, i) => ({
        practice_id: practice.id,
        i,
        en,
        zh: zh[i],
        notes: notes[i],
        speaker: speakers[i],
      })),
    );
  if (sentencesError) {
    return { ok: false, stage: "save", reason: sentencesError.message };
  }

  // 5. Audio, waiting out F0's per-minute limit when it's busy.
  const primary = parseVoiceId(voice)!;
  const secondary = voiceB ? parseVoiceId(voiceB) : null;
  let todo = sentences.map((en, i) => ({
    i,
    en,
    ...(speakers[i] === 1 && secondary ? { voice: secondary } : {}),
  }));
  let waits = 0;
  while (todo.length > 0) {
    const batch = await voiceSentences(deps, primary, todo.slice(0, 8));
    for (const { i, path } of batch.done) {
      await admin
        .from("practice_sentences")
        .update({ audio_path: path })
        .eq("practice_id", practice.id)
        .eq("i", i);
    }
    const done = new Set(batch.done.map((d) => d.i));
    todo = todo.filter((s) => !done.has(s.i));
    if (batch.stopped === "busy" && waits < 20) {
      waits += 1;
      await sleep(30_000);
    } else if (batch.stopped) {
      break;
    }
  }

  // 6. Publish it if everything is there; otherwise it stays a draft.
  const { data: saved } = await admin
    .from("practice_sentences")
    .select("i, en, zh, audio_path, notes")
    .eq("practice_id", practice.id)
    .order("i");
  const problems = officialProblems({
    titleEn: written.title,
    titleZh: written.titleZh,
    subtitle: written.subtitle,
    sentences: (saved ?? []).map((s) => ({
      en: s.en,
      zh: s.zh,
      audioPath: s.audio_path,
      notes: s.notes,
    })),
  });
  if (problems.length === 0) {
    await admin
      .from("practices")
      .update(officialColumns("published"))
      .eq("id", practice.id);
  }
  return {
    ok: true,
    id: practice.id,
    published: problems.length === 0,
    problems,
    sentences: sentences.length,
  };
}
