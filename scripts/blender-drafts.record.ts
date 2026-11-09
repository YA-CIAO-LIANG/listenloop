/**
 * Official video materials from Blender's open movies (D118): for each
 * excerpt in lib/blender-films.ts, the subtitles' sentences are
 * translated and annotated by the language model and saved as an official
 * draft (a YouTube material, private and unpublished) for an admin to
 * review and publish. No audio: the film plays through YouTube.
 *
 *   npm run blender:drafts                  # the plan and its worst case
 *   BLENDER_YES=1 npm run blender:drafts    # make the drafts
 *   BLENDER_ONLY=sprite-fright-2 …          # only these excerpts (comma list)
 *
 * Budget: BLENDER_BUDGET_USD (default 0.50), on the admin's batch
 * allowance and the site's monthly cap (D77); every call is in api_calls.
 * An excerpt whose draft exists already (same video and English title) is
 * skipped, and nothing is saved for one that runs out of budget midway.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, it } from "vitest";
import { supabaseAiCache } from "@/auth/ai-cache";
import { supabaseUsageMeter } from "@/auth/creator";
import { getUsageSettings } from "@/auth/usage-settings";
import { annotateBudget, maxCost, translateBudget } from "@/lib/ai/budgets";
import { toMicros } from "@/lib/ai/pricing";
import { getAiProviders } from "@/lib/ai/providers";
import {
  BLENDER_FILMS,
  excerptAttribution,
  excerptProblems,
  excerptSentences,
} from "@/lib/blender-films";
import {
  annotateMissing,
  joinNotes,
  NOTES_CHUNK,
  TRANSLATE_BATCH,
  translateCached,
  type StoredNotes,
} from "@/lib/custom-practice/notes";
import { officialColumns } from "@/lib/material-admin";
import { officialProblems } from "@/lib/official-check";
import type { Database, Json } from "@/lib/supabase/database.types";
import { excerptSeconds } from "@/lib/youtube";
import { batchMeterOptions, emptyTally, guardedMeter, usd } from "./cost-guard";

const env = (name: string) => process.env[name]?.trim() ?? "";
/** Blender's films are stories: the library's talks and stories. */
const CATEGORY = "talks-stories";

it("makes official drafts from Blender's open movies", async () => {
  expect(env("LISTENLOOP_UNATTENDED"), "no paid calls unattended").not.toBe(
    "1",
  );
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  expect(url && key, "Supabase URL and secret key").toBeTruthy();
  const providers = getAiProviders(process.env);
  expect(providers, "AI providers configured in .env.local").not.toBeNull();
  const admin = createClient<Database>(url, key, {
    auth: { persistSession: false },
  });
  const budget = Number(env("BLENDER_BUDGET_USD")) || 0.5;

  // The plan, with each excerpt's worst case, before anything is called.
  const only = env("BLENDER_ONLY").split(",").filter(Boolean);
  const plan = BLENDER_FILMS.flatMap((film) => {
    const srt = readFileSync(`data/subtitles/${film.subtitles}`, "utf8");
    return film.excerpts
      .filter((excerpt) => only.length === 0 || only.includes(excerpt.key))
      .map((excerpt) => ({
        film,
        excerpt,
        sentences: excerptSentences(srt, excerpt),
      }));
  });
  let worst = 0;
  for (const { excerpt, sentences } of plan) {
    expect(excerptProblems(sentences), excerpt.key).toEqual([]);
    const texts = sentences.map((s) => s.en);
    let micros = 0;
    for (let k = 0; k < texts.length; k += TRANSLATE_BATCH) {
      micros += toMicros(
        maxCost(
          translateBudget(texts.slice(k, k + TRANSLATE_BATCH)),
          providers!.language.price,
        ),
      );
    }
    for (let k = 0; k < texts.length; k += NOTES_CHUNK) {
      micros += toMicros(
        maxCost(
          annotateBudget(texts.slice(k, k + NOTES_CHUNK)),
          providers!.language.price,
        ),
      );
    }
    worst += micros;
    console.log(
      `plan: ${excerpt.key} · ${sentences.length} sentences · ${excerptSeconds(sentences)}s · worst ${usd(micros)}`,
    );
  }
  console.log(
    `worst case about ${usd(worst)} (cached sentences cost nothing); budget ${usd(toMicros(budget))}`,
  );
  if (env("BLENDER_YES") !== "1") {
    console.log("Dry run. Set BLENDER_YES=1 to make the drafts.");
    return;
  }

  const { data: owner } = await admin
    .from("profiles")
    .select("user_id")
    .eq("number", 0)
    .maybeSingle();
  expect(owner, "the owner's profile (User 000)").toBeTruthy();
  const ownerId = owner!.user_id;
  const total = emptyTally();
  const meter = guardedMeter(
    supabaseUsageMeter(
      admin,
      ownerId,
      () => new Date(),
      batchMeterOptions(await getUsageSettings(admin)),
    ),
    { current: emptyTally(), total },
    budget,
  );
  const deps = { providers: providers!, meter, cache: supabaseAiCache(admin) };

  for (const { film, excerpt, sentences } of plan) {
    const { data: existing } = await admin
      .from("practices")
      .select("id")
      .eq("youtube_id", film.youtubeId)
      .eq("title_en", excerpt.titleEn)
      .is("removed_at", null)
      .limit(1)
      .maybeSingle();
    if (existing) {
      console.log(`skip ${excerpt.key}: draft ${existing.id} exists`);
      continue;
    }
    const texts = sentences.map((s) => s.en);
    console.log(`\n▶ ${excerpt.key}`);

    const zh: string[] = [];
    let stopped: string | null = null;
    for (let k = 0; k < texts.length && !stopped; k += TRANSLATE_BATCH) {
      const batch = await translateCached(
        deps,
        texts.slice(k, k + TRANSLATE_BATCH),
        { from: "en", to: "zh-Hant" },
      );
      if (batch.ok) zh.push(...batch.value);
      else stopped = `translate: ${batch.reason}`;
    }
    const annotated = stopped
      ? null
      : await annotateMissing(
          deps,
          texts,
          texts.map(() => null),
          Infinity,
        );
    if (annotated && !annotated.ok) stopped = `notes: ${annotated.reason}`;
    const notes = annotated?.ok ? annotated.value : [];
    if (stopped || notes.some((n) => n === null)) {
      console.log(`  stop: ${stopped ?? "notes missing"} (nothing saved)`);
      break;
    }
    const joined = joinNotes(notes as StoredNotes[]);
    const seconds = excerptSeconds(sentences);
    const { data: practice, error } = await admin
      .from("practices")
      .insert({
        user_id: ownerId,
        title: excerpt.titleEn,
        title_en: excerpt.titleEn,
        title_zh: excerpt.titleZh,
        subtitle: excerpt.subtitle,
        source_language: "en",
        ...officialColumns("draft"),
        category: CATEGORY,
        level: film.level,
        youtube_id: film.youtubeId,
        youtube_channel: "Blender",
        // Blender's films are CC BY on their official sites (D118).
        youtube_license: "creativeCommon",
        attribution: excerptAttribution(film, sentences) as unknown as Json,
        estimated_seconds: seconds,
        duration_sec: seconds,
        vocab: joined.vocab as unknown as Json,
        grammar: joined.grammar as unknown as Json,
        notes_generated_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    expect(error, error?.message).toBeNull();
    const { error: sentencesError } = await admin
      .from("practice_sentences")
      .insert(
        sentences.map((s, i) => ({
          practice_id: practice!.id,
          i,
          en: s.en,
          zh: zh[i],
          notes: notes[i] as unknown as Json,
          start_sec: s.start,
          end_sec: s.end,
        })),
      );
    expect(sentencesError, sentencesError?.message).toBeNull();
    const problems = officialProblems({
      titleEn: excerpt.titleEn,
      titleZh: excerpt.titleZh,
      subtitle: excerpt.subtitle,
      sentences: sentences.map((s, i) => ({
        en: s.en,
        zh: zh[i],
        audioPath: null,
        notes: notes[i],
        timed: true,
      })),
    });
    console.log(
      `  draft ${practice!.id}: ${sentences.length} sentences; ${problems.length ? `check: ${problems.join(", ")}` : "ready to publish"}`,
    );
  }
  console.log(
    `\nspent ${usd(total.micros)} in ${total.calls} calls (input ${total.inputTokens}, output ${total.outputTokens} tokens)`,
  );
});
