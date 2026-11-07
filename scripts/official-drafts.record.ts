/**
 * Makes ListenLoop's official sample materials as drafts (P0, D59), with
 * the real providers: one per category 1–10 and four exam-style ones.
 * Each is written by AI, split, translated, annotated, and voiced, then
 * saved as an official draft (private, not published) owned by the first
 * admin ("User 000"), for Joe to review on Admin → Materials.
 *
 *   npm run official:drafts                  # prints the plan and estimate
 *   OFFICIAL_YES=1 npm run official:drafts   # makes them (Joe's go-ahead)
 *
 * Cost guard (CLAUDE.md, "AI 供應者與測試"): every language call reserves
 * its worst case first; a reservation that would take the run past
 * BUDGET_USD is refused, and the run stops. Speech is Azure F0 (free).
 * A draft that already exists (same owner and scenario) is skipped, so a
 * stopped run can simply be started again. Every call is in api_calls.
 */
import { createClient } from "@supabase/supabase-js";
import { emptyTally, guardedMeter, usd } from "./cost-guard";
import { expect, it } from "vitest";
import { supabaseAiCache } from "@/auth/ai-cache";
import { supabaseAudioStore } from "@/auth/audio-store";
import { supabaseUsageMeter } from "@/auth/creator";
import { composeBudget, maxCost } from "@/lib/ai/budgets";
import { meteredLanguage } from "@/lib/ai/metered";
import { getAiProviders } from "@/lib/ai/providers";
import { toMicros } from "@/lib/ai/pricing";
import { parseVoiceId, type VoiceAccent } from "@/lib/ai/types";
import { voiceSentences } from "@/lib/custom-practice/audio";
import {
  checkGeneratedText,
  compositionPrompt,
  materialMeta,
  parseGenerationRequest,
  type GenerationRequest,
} from "@/lib/custom-practice/generation";
import {
  annotateMissing,
  joinNotes,
  segmentLines,
  TRANSLATE_BATCH,
  translateCached,
  type SentenceNotes,
} from "@/lib/custom-practice/notes";
import { speakerLines, withSpeakers } from "@/lib/custom-practice/speakers";
import type { Database } from "@/lib/supabase/database.types";
import { countChars, OFFICIAL_DAILY_LIMITS } from "@/lib/usage";

/** Joe's approved total for tonight's real calls (2026-11-07). */
const BUDGET_USD = 1.0;

type Spec = GenerationRequest & { accent: VoiceAccent };

/** One per category 1–10, then the four exams (D59). */
export const SPECS: Spec[] = (
  [
    {
      scenario: "coffee-shop",
      level: "beginner",
      length: "1-2",
      format: "dialogue",
      accent: "us",
      topic:
        "a Taiwanese exchange student ordering a drink and a snack for the first time, asking about cup sizes and milk options",
    },
    {
      scenario: "airport-check-in",
      level: "beginner",
      length: "1-2",
      format: "dialogue",
      accent: "gb",
      topic:
        "a student checking in for a flight home to Taipei, with a bag that is slightly overweight",
    },
    {
      scenario: "bank-account",
      level: "intermediate",
      length: "2-3",
      format: "dialogue",
      accent: "au",
      topic:
        "a new international student from Taiwan opening a student bank account and asking about fees and a debit card",
    },
    {
      scenario: "weekend-plans",
      level: "intermediate",
      length: "1-2",
      format: "dialogue",
      accent: "us",
      topic:
        "two classmates deciding between a hiking trip and a night market food festival",
    },
    {
      scenario: "office-hours",
      level: "intermediate",
      length: "2-3",
      format: "dialogue",
      accent: "in",
      topic:
        "a student asking a professor how to improve a midterm essay and narrow a research question",
    },
    {
      scenario: "abstract",
      level: "advanced",
      length: "1-2",
      format: "monologue",
      accent: "gb",
      topic:
        "a study on how short daily listening practice affects university students' listening confidence",
    },
    {
      scenario: "job-interview",
      level: "intermediate",
      length: "2-3",
      format: "dialogue",
      accent: "au",
      topic:
        "a recent graduate interviewing for a junior marketing role, talking about a team project and strengths",
    },
    {
      scenario: "news-tech",
      level: "intermediate",
      length: "1-2",
      format: "monologue",
      accent: "us",
      topic: "a city testing self-driving buses on a university campus route",
    },
    {
      scenario: "psychology",
      level: "advanced",
      length: "2-3",
      format: "monologue",
      accent: "in",
      topic:
        "why people procrastinate and what research suggests about breaking tasks into small steps",
    },
    {
      scenario: "personal-growth",
      level: "intermediate",
      length: "2-3",
      format: "monologue",
      accent: "gb",
      topic:
        "a student who was afraid of speaking English in class and slowly built confidence",
    },
    {
      scenario: "toefl-lecture-biology",
      level: "toefl-100",
      length: "2-3",
      format: "monologue",
      accent: "us",
      topic: "how some desert plants store water and survive long droughts",
    },
    {
      scenario: "ielts-part1",
      level: "ielts-6.5",
      length: "1-2",
      format: "dialogue",
      accent: "gb",
      topic:
        "a student phoning a sports centre to book a beginner swimming course",
    },
    {
      scenario: "toeic-conversation",
      level: "toeic-750",
      length: "1-2",
      format: "dialogue",
      accent: "au",
      topic:
        "two coworkers rescheduling a client meeting because a shipment is delayed",
    },
    {
      scenario: "gept-conversation",
      level: "gept-intermediate",
      length: "1-2",
      format: "dialogue",
      accent: "us",
      topic:
        "two high school students planning a group study session before an exam",
    },
  ] as const satisfies readonly Spec[]
).map((spec) => ({ ...spec }));

const env = (name: string) => process.env[name]?.trim() ?? "";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

it("makes the official drafts", { timeout: 3_600_000 }, async () => {
  // Never in an unattended run (scripts/auto-continue/run.sh, D65).
  expect(env("LISTENLOOP_UNATTENDED"), "no paid calls unattended").not.toBe(
    "1",
  );
  const providers = getAiProviders(process.env);
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  expect(providers, "AI providers configured in .env.local").not.toBeNull();
  expect(url && key, "Supabase URL and secret key in .env.local").toBeTruthy();
  const admin = createClient<Database>(url, key, {
    auth: { persistSession: false },
  });
  const { data: owner } = await admin
    .from("profiles")
    .select("user_id")
    .eq("number", 0)
    .maybeSingle();
  expect(owner, "the owner's profile (User 000)").toBeTruthy();
  const ownerId = owner!.user_id;

  // The plan and its estimate, before anything is called.
  let worst = 0;
  for (const spec of SPECS) {
    const request = parseGenerationRequest(spec);
    expect(request, `spec ${spec.scenario}`).not.toBeNull();
    const words = compositionPrompt(request!).words;
    // Compose, then split, translate, and annotate about as many words.
    const compose = maxCost(
      composeBudget(compositionPrompt(request!)),
      providers!.language.price,
    );
    worst += toMicros(compose) * 4;
    console.log(
      `plan: ${spec.scenario} · ${spec.level} · ${spec.length} min · ${spec.format} · ${spec.accent} (~${words} words)`,
    );
  }
  console.log(
    `worst case about ${usd(worst)}; budget ${usd(toMicros(BUDGET_USD))}; speech on Azure F0 (free)`,
  );
  if (env("OFFICIAL_YES") !== "1") {
    console.log("Dry run. Set OFFICIAL_YES=1 to make the drafts.");
    return;
  }

  const total = emptyTally();
  const report: string[] = [];
  for (const spec of SPECS) {
    const request = parseGenerationRequest(spec)!;
    const meta = materialMeta(request)!;
    const { data: existing } = await admin
      .from("practices")
      .select("id, title")
      .eq("user_id", ownerId)
      .eq("official", true)
      .eq("scenario", meta.scenario)
      .maybeSingle();
    if (existing) {
      console.log(`skip ${meta.scenario}: "${existing.title}" exists`);
      continue;
    }
    const tally = { current: emptyTally(), total };
    const deps = {
      providers: providers!,
      meter: guardedMeter(
        supabaseUsageMeter(
          admin,
          ownerId,
          () => new Date(),
          OFFICIAL_DAILY_LIMITS,
        ),
        tally,
        BUDGET_USD,
      ),
      cache: supabaseAiCache(admin),
      store: supabaseAudioStore(admin),
    };
    console.log(`\n▶ ${meta.category} / ${meta.scenario}`);

    // 1. Write the text.
    const prompt = compositionPrompt(request);
    const written = await meteredLanguage(deps, composeBudget(prompt), () =>
      deps.providers.language.compose(prompt),
    );
    if (!written.ok) {
      console.log(`  stop: compose ${written.reason}`);
      break;
    }
    const text = checkGeneratedText(written.value, prompt.words);
    if (!text) {
      console.log("  the written text wasn't usable; skipped");
      continue;
    }
    const body =
      spec.format === "dialogue" ? withSpeakers(text.text) : text.text;

    // 2. Split (labels off), keeping each sentence's speaker.
    const lines = speakerLines(body);
    const pieces = await segmentLines(
      deps,
      lines.map((l) => l.text),
      "en",
    );
    const sentences = pieces.flat();
    const speakers = lines.flatMap((line, i) =>
      pieces[i].map(() =>
        spec.format === "dialogue" ? (line.speaker ?? 0) : null,
      ),
    );

    // 3. Translate, a batch at a time.
    const zh: string[] = [];
    for (let start = 0; start < sentences.length; start += TRANSLATE_BATCH) {
      const batch = await translateCached(
        deps,
        sentences.slice(start, start + TRANSLATE_BATCH),
        {
          from: "en",
          to: "zh-Hant",
        },
      );
      if (!batch.ok) throw new Error(`translate: ${batch.reason}`);
      zh.push(...batch.value);
    }

    // 4. Notes for every sentence.
    const annotated = await annotateMissing(
      deps,
      sentences,
      sentences.map(() => null),
      Infinity,
    );
    if (!annotated.ok) throw new Error(`notes: ${annotated.reason}`);
    const notes = annotated.value.map(
      (n) => n ?? { vocab: [], grammar: [] },
    ) as SentenceNotes[];
    const joined = joinNotes(notes);

    // 5. Save it as an official draft.
    const voice = `${spec.accent}-female`;
    const voiceB = spec.format === "dialogue" ? `${spec.accent}-male` : null;
    const { data: practice, error } = await admin
      .from("practices")
      .insert({
        user_id: ownerId,
        title: text.title,
        source_language: "en",
        voice,
        voice_b: voiceB,
        visibility: "private",
        official: true,
        published: false,
        category: meta.category,
        scenario: meta.scenario,
        level: meta.level,
        exam: meta.exam,
        exam_target: meta.examTarget,
        vocab: joined.vocab,
        grammar: joined.grammar,
        notes_generated_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error || !practice) throw new Error(`save: ${error?.message}`);
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
    if (sentencesError)
      throw new Error(`save sentences: ${sentencesError.message}`);

    // 6. Audio, waiting out F0's per-minute limit when it's busy.
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
        console.log(
          `  audio stopped: ${batch.stopped}; ${todo.length} left (resume from My materials)`,
        );
        break;
      }
    }

    const c = tally.current;
    const minutes = (countChars(sentences) / 15 / 60).toFixed(1);
    const line = `${practice.id}\t${text.title}\t${meta.category}/${meta.scenario}\t${spec.format}\t${spec.accent}\t~${minutes} min\t${sentences.length} sentences\tin ${c.inputTokens} / out ${c.outputTokens} tokens\t${c.chars} chars\t${usd(c.micros)}`;
    console.log(`  ✓ ${line}`);
    report.push(line);
  }
  console.log("\nREPORT");
  for (const line of report) console.log(line);
  console.log(
    `TOTAL\tin ${total.inputTokens} / out ${total.outputTokens} tokens\t${total.chars} chars\t${usd(total.micros)}\t${total.calls} calls`,
  );
});
