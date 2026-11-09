/**
 * Makes ListenLoop's official materials (P0, D59, D84, D99), with the
 * real providers, from SPECS. Each is written by AI, split, translated,
 * annotated, and voiced, saved as an official material owned by the
 * first admin ("User 000"), then checked (lib/official-check.ts): a
 * complete one is published at once (D99), anything missing stays a
 * draft for Joe on Admin → Official materials.
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
import { emptyTally, guardedMeter, usd, batchMeterOptions } from "./cost-guard";
import { getUsageSettings } from "@/auth/usage-settings";
import { expect, it } from "vitest";
import { supabaseAiCache } from "@/auth/ai-cache";
import { supabaseAudioStore } from "@/auth/audio-store";
import { supabaseUsageMeter } from "@/auth/creator";
import { composeBudget, describeBudget, maxCost } from "@/lib/ai/budgets";
import { subtitleFromModel } from "@/lib/custom-practice/subtitle";
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
import { countChars } from "@/lib/usage";
import { officialColumns } from "@/lib/material-admin";
import { officialProblems } from "@/lib/official-check";

/**
 * This run's share of Joe's approved US$1.50 for the night of 2026-11-08
 * (official and news materials, D99); the news run has its own.
 */
const BUDGET_USD = Number(process.env.OFFICIAL_BUDGET_USD) || 0.95;

type Spec = Omit<
  GenerationRequest,
  "customScenario" | "customCategory" | "titleEn" | "titleZh"
> & {
  accent: VoiceAccent;
};

/**
 * The night of 2026-11-08 (D99): a new scenario for every category, the
 * emptiest first, 30 seconds to 2 minutes, levels and accents spread.
 * Earlier runs' specs (D59, D84) are in git history; their materials exist.
 */
export const SPECS: GenerationRequest[] = (
  [
    {
      scenario: "restaurant",
      level: "beginner",
      length: "30s",
      format: "dialogue",
      accent: "us",
      topic:
        "ordering lunch at a small diner and asking what the soup of the day is",
    },
    {
      scenario: "apartment-viewing",
      level: "intermediate",
      length: "1-2",
      format: "dialogue",
      accent: "gb",
      topic:
        "viewing a flat with a landlord and asking about heating, rent, and the deposit",
    },
    {
      scenario: "immigration",
      level: "beginner",
      length: "30s",
      format: "dialogue",
      accent: "au",
      topic:
        "answering an officer's questions at passport control on arrival for a study exchange",
    },
    {
      scenario: "train-station",
      level: "intermediate",
      length: "1-2",
      format: "dialogue",
      accent: "in",
      topic:
        "buying a train ticket, finding the platform, and asking about a delayed train",
    },
    {
      scenario: "arrival-check-in",
      level: "beginner",
      length: "1-2",
      format: "dialogue",
      accent: "us",
      topic:
        "a new international student checking in at the dorm front desk and getting keys and a welcome pack",
    },
    {
      scenario: "phone-plan",
      level: "intermediate",
      length: "30s",
      format: "dialogue",
      accent: "gb",
      topic: "choosing a prepaid phone plan with data at a mobile shop",
    },
    {
      scenario: "friends-chat",
      level: "intermediate",
      length: "1-2",
      format: "dialogue",
      accent: "us",
      topic:
        "two friends catching up about classes, a part-time job, and weekend plans",
    },
    {
      scenario: "food-picks",
      level: "beginner",
      length: "30s",
      format: "monologue",
      accent: "us",
      topic: "someone describing their three favorite cheap eats near campus",
    },
    {
      scenario: "library",
      level: "beginner",
      length: "30s",
      format: "dialogue",
      accent: "gb",
      topic: "asking a librarian how to borrow a book and book a study room",
    },
    {
      scenario: "lab-safety",
      level: "intermediate",
      length: "1-2",
      format: "monologue",
      accent: "au",
      topic:
        "a teaching assistant explaining safety rules before a chemistry lab",
    },
    {
      scenario: "methods",
      level: "advanced",
      length: "1-2",
      format: "monologue",
      accent: "gb",
      topic:
        "a student explaining the methods section of a small survey study on sleep and grades",
    },
    {
      scenario: "peer-review-feedback",
      level: "intermediate",
      length: "1-2",
      format: "dialogue",
      accent: "us",
      topic:
        "two classmates giving each other kind, specific feedback on essay drafts",
    },
    {
      scenario: "phone-call",
      level: "intermediate",
      length: "30s",
      format: "dialogue",
      accent: "in",
      topic: "calling a supplier to confirm a delivery date for an order",
    },
    {
      scenario: "product-presentation",
      level: "advanced",
      length: "1-2",
      format: "monologue",
      accent: "us",
      topic:
        "presenting a new reusable water bottle with a filter to potential buyers",
    },
    {
      scenario: "history",
      level: "intermediate",
      length: "1-2",
      format: "monologue",
      accent: "gb",
      topic:
        "a short talk on how the printing press changed the way people shared ideas",
    },
    {
      scenario: "nutrition-science",
      level: "beginner",
      length: "30s",
      format: "monologue",
      accent: "au",
      topic: "why breakfast with protein keeps you full longer",
    },
    {
      scenario: "graduation-speech",
      level: "intermediate",
      length: "1-2",
      format: "monologue",
      accent: "us",
      topic:
        "a student's graduation speech about small habits and thanking the people who helped",
    },
    {
      scenario: "book-review",
      level: "intermediate",
      length: "30s",
      format: "monologue",
      accent: "in",
      topic: "a quick review of a mystery novel without spoilers",
    },
    {
      scenario: "dentist",
      level: "beginner",
      length: "30s",
      format: "dialogue",
      accent: "gb",
      topic:
        "a patient at the dentist describing a toothache and making a follow-up appointment",
    },
    {
      scenario: "symptoms",
      level: "intermediate",
      length: "1-2",
      format: "dialogue",
      accent: "us",
      topic: "describing a cough and headache to a nurse at a walk-in clinic",
    },
    {
      scenario: "apologizing",
      level: "beginner",
      length: "30s",
      format: "dialogue",
      accent: "au",
      topic:
        "apologizing to a friend for being late and offering to pay for coffee",
    },
    {
      scenario: "family-video-call",
      level: "intermediate",
      length: "1-2",
      format: "dialogue",
      accent: "in",
      topic:
        "a student on a video call with their parents, sharing news about exams and food",
    },
    {
      scenario: "tech-support",
      level: "intermediate",
      length: "1-2",
      format: "dialogue",
      accent: "us",
      topic:
        "calling tech support because a laptop won't connect to the campus Wi-Fi",
    },
    {
      scenario: "smartphone-setup",
      level: "beginner",
      length: "30s",
      format: "monologue",
      accent: "gb",
      topic: "simple steps to set up a new phone and back up photos",
    },
    {
      scenario: "bank-transfer",
      level: "beginner",
      length: "30s",
      format: "dialogue",
      accent: "in",
      topic: "asking a bank clerk how to send money home and what the fee is",
    },
    {
      scenario: "tax-filing",
      level: "advanced",
      length: "1-2",
      format: "monologue",
      accent: "us",
      topic:
        "an explainer on what a student with a part-time job needs to file a tax return",
    },
    {
      scenario: "first-day",
      level: "beginner",
      length: "1-2",
      format: "dialogue",
      accent: "au",
      topic:
        "a new intern's first day: meeting the manager, getting a badge, and lunch plans",
    },
    {
      scenario: "networking-event",
      level: "intermediate",
      length: "30s",
      format: "dialogue",
      accent: "gb",
      topic: "introducing yourself to an engineer at a networking event",
    },
    {
      scenario: "movie-night",
      level: "beginner",
      length: "30s",
      format: "dialogue",
      accent: "us",
      topic: "friends choosing a movie and snacks for a movie night",
    },
    {
      scenario: "outdoor-activity",
      level: "intermediate",
      length: "1-2",
      format: "monologue",
      accent: "au",
      topic: "a guide's briefing before a beginner kayaking trip",
    },
    {
      scenario: "farmers-market",
      level: "beginner",
      length: "30s",
      format: "dialogue",
      accent: "gb",
      topic:
        "buying fruit at a farmers market and asking which apples are sweet",
    },
    {
      scenario: "food-culture",
      level: "advanced",
      length: "1-2",
      format: "monologue",
      accent: "in",
      topic: "how sharing food at the table differs across cultures",
    },
    {
      scenario: "tipping",
      level: "intermediate",
      length: "1-2",
      format: "monologue",
      accent: "us",
      topic:
        "a friendly guide to tipping in the United States: restaurants, taxis, and delivery",
    },
    {
      scenario: "gift-giving",
      level: "beginner",
      length: "30s",
      format: "dialogue",
      accent: "in",
      topic:
        "choosing a small gift for a host family and asking what is polite",
    },
  ] as const satisfies readonly Spec[]
).map((spec) => ({ ...spec, customScenario: "", titleEn: "", titleZh: "" }));

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
  const batchOptions = batchMeterOptions(await getUsageSettings(admin));
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
      `plan: ${spec.scenario} · ${spec.level} · ${spec.length} · ${spec.format} · ${spec.accent} (~${words} words)`,
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
  // Out of budget mid-draft: stop there, still printing the report.
  drafts: for (const spec of SPECS) {
    const request = parseGenerationRequest(spec)!;
    const meta = materialMeta(request)!;
    const { data: existing } = await admin
      .from("practices")
      .select("id, title")
      .eq("user_id", ownerId)
      .eq("official", true)
      .eq("scenario", meta.scenario ?? "")
      .limit(1)
      .maybeSingle();
    if (existing) {
      console.log(`skip ${meta.scenario}: "${existing.title}" exists`);
      continue;
    }
    const tally = { current: emptyTally(), total };
    const deps = {
      providers: providers!,
      meter: guardedMeter(
        supabaseUsageMeter(admin, ownerId, () => new Date(), batchOptions),
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
    // Both titles and a subtitle come with the text (D83); the rare one
    // missing either is described in one more short call.
    let labels = {
      titleZh: text.titleZh,
      subtitle: text.subtitle,
    };
    if (!labels.titleZh || !labels.subtitle) {
      const input = { title: text.title, text: text.text, titleEn: text.title };
      const described = await meteredLanguage(deps, describeBudget(input), () =>
        deps.providers.language.describe(input),
      );
      if (!described.ok) {
        console.log(`  stop: describe ${described.reason}`);
        break;
      }
      const value = (described.value ?? {}) as { titleZh?: unknown };
      labels = {
        titleZh:
          labels.titleZh ||
          (typeof value.titleZh === "string" ? value.titleZh.trim() : ""),
        subtitle: labels.subtitle || (subtitleFromModel(described.value) ?? ""),
      };
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
      if (!batch.ok) {
        console.log(`  stop: translate ${batch.reason}`);
        break drafts;
      }
      zh.push(...batch.value);
    }

    // 4. Notes for every sentence.
    const annotated = await annotateMissing(
      deps,
      sentences,
      sentences.map(() => null),
      Infinity,
    );
    if (!annotated.ok) {
      console.log(`  stop: notes ${annotated.reason}`);
      break;
    }
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
        title_en: text.title,
        title_zh: labels.titleZh || null,
        subtitle: labels.subtitle || null,
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

    // 7. Publish it if everything is there (D99); otherwise it stays a
    // draft and the report says what's missing.
    const { data: saved } = await admin
      .from("practice_sentences")
      .select("i, en, zh, audio_path, notes")
      .eq("practice_id", practice.id)
      .order("i");
    const problems = officialProblems({
      titleEn: text.title,
      titleZh: labels.titleZh,
      subtitle: labels.subtitle,
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
    const state =
      problems.length === 0 ? "published" : `draft (${problems.join(", ")})`;

    const c = tally.current;
    const minutes = (countChars(sentences) / 15 / 60).toFixed(1);
    const line = `${practice.id}\t${state}\t${text.title}｜${labels.titleZh}\t${meta.category}/${meta.scenario}\t${spec.level}\t${spec.format}\t${spec.accent}\t~${minutes} min\t${sentences.length} sentences\tin ${c.inputTokens} / out ${c.outputTokens} tokens\t${c.chars} chars\t${usd(c.micros)}`;
    console.log(`  ✓ ${line}`);
    report.push(line);
  }
  console.log("\nREPORT");
  for (const line of report) console.log(line);
  console.log(
    `TOTAL\tin ${total.inputTokens} / out ${total.outputTokens} tokens\t${total.chars} chars\t${usd(total.micros)}\t${total.calls} calls`,
  );
});
