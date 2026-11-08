/**
 * Makes ListenLoop's official sample materials as drafts (P0, D59, D84),
 * with the real providers, from SPECS.
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

/**
 * Joe's approved total for the night of 2026-11-08 (US$0.50), less the
 * fixture re-record that came first (D84).
 */
const BUDGET_USD = 0.49;

type Spec = Omit<
  GenerationRequest,
  "customScenario" | "customCategory" | "titleEn" | "titleZh"
> & {
  accent: VoiceAccent;
};

/**
 * Two drafts for every category (D84), the emptiest first: one for each
 * category added in D81, then their second, then a second for the rest.
 * Levels and accents are spread out; the run stops when the budget does.
 * The first run's specs (D59) are in git history; their drafts exist.
 */
export const SPECS: GenerationRequest[] = (
  [
    {
      scenario: "appointment-booking",
      level: "beginner",
      length: "1-2",
      format: "dialogue",
      accent: "us",
      topic:
        "an international student calling the campus clinic to book an appointment for a sore throat and a fever",
    },
    {
      scenario: "declining-invitation",
      level: "intermediate",
      length: "1-2",
      format: "dialogue",
      accent: "gb",
      topic:
        "politely turning down a friend's birthday dinner because of a big exam the next morning, and suggesting another day",
    },
    {
      scenario: "account-security",
      level: "intermediate",
      length: "1-2",
      format: "monologue",
      accent: "au",
      topic:
        "a short how-to after a fake login email: changing your password and turning on two-step verification",
    },
    {
      scenario: "budgeting",
      level: "beginner",
      length: "1-2",
      format: "monologue",
      accent: "in",
      topic:
        "a first-year student explaining how they split a monthly budget between rent, food, transport, and savings",
    },
    {
      scenario: "internship-interview",
      level: "intermediate",
      length: "2-3",
      format: "dialogue",
      accent: "us",
      topic:
        "a student interviewing for a summer internship at a small design studio, talking about a class project and teamwork",
    },
    {
      scenario: "gym-signup",
      level: "beginner",
      length: "1-2",
      format: "dialogue",
      accent: "au",
      topic:
        "signing up for the university gym, asking about opening hours, lockers, and a free beginner class",
    },
    {
      scenario: "dietary-needs",
      level: "intermediate",
      length: "1-2",
      format: "dialogue",
      accent: "gb",
      topic:
        "ordering at a restaurant with a peanut allergy, checking the sauces and asking how the food is prepared",
    },
    {
      scenario: "culture-shock",
      level: "intermediate",
      length: "1-2",
      format: "monologue",
      accent: "in",
      topic:
        "an exchange student describing small surprises in the first month abroad: tipping, small talk with strangers, and dinner times",
    },
    {
      scenario: "counseling-booking",
      level: "advanced",
      length: "1-2",
      format: "dialogue",
      accent: "gb",
      topic:
        "a student contacting the counseling center about exam stress and trouble sleeping, and choosing between a workshop and a one-to-one session",
    },
    {
      scenario: "roommate-conflict",
      level: "beginner",
      length: "1-2",
      format: "dialogue",
      accent: "us",
      topic:
        "two roommates calmly sorting out dirty dishes left in the sink and making a simple cleaning schedule",
    },
    {
      scenario: "ai-tools",
      level: "advanced",
      length: "1-2",
      format: "monologue",
      accent: "us",
      topic:
        "a professor's guidance on using AI writing tools responsibly for homework: what is allowed and how to cite it",
    },
    {
      scenario: "lease-terms",
      level: "intermediate",
      length: "2-3",
      format: "dialogue",
      accent: "au",
      topic:
        "a student asking a landlord about the security deposit, utilities, and ending the lease early",
    },
    {
      scenario: "career-advice",
      level: "advanced",
      length: "1-2",
      format: "monologue",
      accent: "in",
      topic:
        "a mentor's advice on the first year in a new job: asking questions early, keeping notes, and building trust",
    },
    {
      scenario: "trip-planning",
      level: "intermediate",
      length: "1-2",
      format: "dialogue",
      accent: "gb",
      topic:
        "two friends planning a weekend trip by train on a small budget, choosing where to stay and what to see",
    },
    {
      scenario: "recipe",
      level: "beginner",
      length: "1-2",
      format: "monologue",
      accent: "au",
      topic: "a step-by-step way to make Taiwanese scallion pancakes at home",
    },
    {
      scenario: "lunar-new-year",
      level: "beginner",
      length: "1-2",
      format: "monologue",
      accent: "us",
      topic:
        "a Taiwanese student telling classmates how their family celebrates Lunar New Year: cleaning, the reunion dinner, and red envelopes",
    },
    {
      scenario: "pharmacy",
      level: "beginner",
      length: "1-2",
      format: "dialogue",
      accent: "gb",
      topic:
        "asking a pharmacist for something for a cold, and how often to take it",
    },
    {
      scenario: "hotel",
      level: "intermediate",
      length: "1-2",
      format: "dialogue",
      accent: "in",
      topic:
        "checking in late at a hotel and finding the booked room has two beds instead of one",
    },
    {
      scenario: "course-registration",
      level: "intermediate",
      length: "1-2",
      format: "dialogue",
      accent: "us",
      topic:
        "a student asking an advisor how to get into a full class and whether to join the waitlist",
    },
    {
      scenario: "small-talk",
      level: "beginner",
      length: "1-2",
      format: "dialogue",
      accent: "us",
      topic:
        "two neighbors making small talk in an elevator about the weather and weekend plans",
    },
    {
      scenario: "group-project",
      level: "intermediate",
      length: "1-2",
      format: "dialogue",
      accent: "au",
      topic:
        "a group project team dividing the work fairly and setting a deadline for the first draft",
    },
    {
      scenario: "conference-talk",
      level: "advanced",
      length: "1-2",
      format: "monologue",
      accent: "us",
      topic:
        "the opening of a short student conference talk about how campus bike sharing changed commuting",
    },
    {
      scenario: "meeting",
      level: "intermediate",
      length: "1-2",
      format: "dialogue",
      accent: "gb",
      topic:
        "a short team meeting to decide whether to delay a product launch by one week",
    },
    {
      scenario: "news-environment",
      level: "intermediate",
      length: "1-2",
      format: "monologue",
      accent: "au",
      topic:
        "a news report on a coastal town replanting mangroves to protect against storms",
    },
    {
      scenario: "space",
      level: "advanced",
      length: "1-2",
      format: "monologue",
      accent: "gb",
      topic:
        "why astronauts lose muscle and bone strength in space, and how they exercise to stay healthy",
    },
    {
      scenario: "travel-story",
      level: "intermediate",
      length: "1-2",
      format: "monologue",
      accent: "in",
      topic:
        "a traveler's story about missing the last train in a small town and the stranger who helped",
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

    const c = tally.current;
    const minutes = (countChars(sentences) / 15 / 60).toFixed(1);
    const line = `${practice.id}\t${text.title}｜${labels.titleZh}\t${meta.category}/${meta.scenario}\t${spec.format}\t${spec.accent}\t~${minutes} min\t${sentences.length} sentences\tin ${c.inputTokens} / out ${c.outputTokens} tokens\t${c.chars} chars\t${usd(c.micros)}`;
    console.log(`  ✓ ${line}`);
    report.push(line);
  }
  console.log("\nREPORT");
  for (const line of report) console.log(line);
  console.log(
    `TOTAL\tin ${total.inputTokens} / out ${total.outputTokens} tokens\t${total.chars} chars\t${usd(total.micros)}\t${total.calls} calls`,
  );
});
