/**
 * Publishes the hand-written official materials in data/official/ (D213):
 * the English, Chinese, and notes are written in the files (no language
 * model is called); only the voice is made, with Azure Speech F0 (free).
 * Each is saved as an official draft owned by the first admin ("User
 * 000"), voiced, checked (lib/official-check.ts), and published when
 * nothing is missing; otherwise it stays a draft.
 *
 *   npm run official:written                    # prints the plan
 *   OFFICIAL_WRITTEN_YES=1 npm run official:written   # makes them
 *
 * A material that already exists (same owner, same English title) is
 * skipped, so a stopped run can simply be started again. Stops before
 * SPEECH_BUDGET characters (Joe, 2026-11-25: at most 120,000 for the
 * night, and 150,000 kept for Beta learners); a material that can't be
 * voiced in full stays a draft.
 */
import { readdirSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, it } from "vitest";
import { supabaseAudioStore } from "@/auth/audio-store";
import { supabaseUsageMeter } from "@/auth/creator";
import { getUsageSettings } from "@/auth/usage-settings";
import { getAiProviders } from "@/lib/ai/providers";
import { parseVoiceId } from "@/lib/ai/types";
import { voiceSentences } from "@/lib/custom-practice/audio";
import { joinNotes } from "@/lib/custom-practice/notes";
import { officialColumns } from "@/lib/material-admin";
import { officialProblems } from "@/lib/official-check";
import {
  parseWrittenMaterial,
  type WrittenOfficial,
} from "@/lib/official-written";
import type { Database } from "@/lib/supabase/database.types";
import { batchMeterOptions } from "./cost-guard";

/**
 * Speech characters this run may use: Joe's 120,000 for the night less
 * what earlier runs used. Counted here from what's sent, not from
 * api_calls (a select returns at most 1,000 rows, which undercounts).
 */
const BUDGET_CHARS = Number(process.env.SPEECH_BUDGET) || 0;
const DIR = "data/official";
const env = (name: string) => process.env[name] ?? "";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

it(
  "publishes the hand-written official materials",
  { timeout: 7_200_000 },
  async () => {
    expect(env("LISTENLOOP_UNATTENDED"), "no paid calls unattended").not.toBe(
      "1",
    );
    const providers = getAiProviders(process.env);
    const url = env("NEXT_PUBLIC_SUPABASE_URL");
    const key = env("SUPABASE_SERVICE_ROLE_KEY");
    expect(providers, "AI providers configured in .env.local").not.toBeNull();
    expect(url && key, "Supabase URL and secret key").toBeTruthy();
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

    const materials: WrittenOfficial[] = readdirSync(DIR)
      .filter((f) => f.endsWith(".json"))
      .sort()
      .map((f) => {
        const parsed = parseWrittenMaterial(
          JSON.parse(readFileSync(`${DIR}/${f}`, "utf8")),
        );
        expect(parsed, f).not.toBeNull();
        return parsed!;
      });

    // ONLY_KNOWN=1: only categories the live site already knows (the new
    // ones wait for their deploy).
    const fresh = (m: WrittenOfficial) =>
      m.meta.category === "classics" ||
      m.meta.category === "school" ||
      m.meta.exam === "gsat";
    const todo: WrittenOfficial[] = [];
    for (const m of materials.filter(
      (m) => env("ONLY_KNOWN") !== "1" || !fresh(m),
    )) {
      const { data: existing } = await admin
        .from("practices")
        .select("id")
        .eq("user_id", ownerId)
        .eq("official", true)
        .eq("title_en", m.title)
        .limit(1)
        .maybeSingle();
      if (existing) console.log(`skip ${m.slug}: exists`);
      else todo.push(m);
    }
    const chars = todo.reduce(
      (sum, m) => sum + m.sentences.reduce((n, s) => n + s.en.length, 0),
      0,
    );
    console.log(
      `${materials.length} materials, ${todo.length} to make, at most ${chars} speech characters (fewer with the shared cache); budget ${BUDGET_CHARS}.`,
    );
    if (env("OFFICIAL_WRITTEN_YES") !== "1") {
      console.log("Dry run. Set OFFICIAL_WRITTEN_YES=1 to make them.");
      return;
    }

    const deps = {
      providers: providers!,
      meter: supabaseUsageMeter(
        admin,
        ownerId,
        () => new Date(),
        batchMeterOptions(await getUsageSettings(admin)),
      ),
      store: supabaseAudioStore(admin),
    };
    const report: string[] = [];
    let spent = 0;
    for (const m of todo) {
      const need = m.sentences.reduce((n, s) => n + s.en.length, 0);
      if (spent + need > BUDGET_CHARS) {
        report.push(`${m.slug}: not made (over the night's speech budget)`);
        continue;
      }
      spent += need;
      const dialogue = m.format === "dialogue";
      const voice = `${m.accent}-female`;
      const voiceB = dialogue ? `${m.accent}-male` : null;
      const notes = m.sentences.map((s) => s.notes);
      const joined = joinNotes(notes);
      const { data: practice, error } = await admin
        .from("practices")
        .insert({
          user_id: ownerId,
          title: m.title,
          title_en: m.title,
          title_zh: m.titleZh,
          subtitle: m.subtitle,
          source_language: "en",
          voice,
          voice_b: voiceB,
          ...officialColumns("draft"),
          category: m.meta.category,
          scenario: m.meta.scenario,
          level: m.meta.level,
          exam: m.meta.exam,
          exam_target: m.meta.examTarget,
          vocab: joined.vocab,
          grammar: joined.grammar,
          notes_generated_at: new Date().toISOString(),
          ...(m.source.kind !== "original"
            ? {
                source_name: m.source.name,
                source_title: m.source.title.slice(0, 300),
                source_url: m.source.url,
              }
            : {}),
        })
        .select("id")
        .single();
      if (error || !practice) {
        report.push(`${m.slug}: save failed ${error?.message}`);
        continue;
      }
      const { error: sentencesError } = await admin
        .from("practice_sentences")
        .insert(
          m.sentences.map((s, i) => ({
            practice_id: practice.id,
            i,
            en: s.en,
            zh: s.zh,
            notes: s.notes,
            speaker: dialogue ? s.speaker : null,
          })),
        );
      if (sentencesError) {
        report.push(`${m.slug}: sentences failed ${sentencesError.message}`);
        continue;
      }
      const primary = parseVoiceId(voice)!;
      const secondary = voiceB ? parseVoiceId(voiceB) : null;
      let pending = m.sentences.map((s, i) => ({
        i,
        en: s.en,
        ...(dialogue && s.speaker === 1 && secondary
          ? { voice: secondary }
          : {}),
      }));
      let waits = 0;
      while (pending.length > 0) {
        const batch = await voiceSentences(deps, primary, pending.slice(0, 8));
        for (const { i, path } of batch.done) {
          await admin
            .from("practice_sentences")
            .update({ audio_path: path })
            .eq("practice_id", practice.id)
            .eq("i", i);
        }
        const done = new Set(batch.done.map((d) => d.i));
        pending = pending.filter((s) => !done.has(s.i));
        if (batch.stopped === "busy" && waits < 20) {
          waits += 1;
          await sleep(30_000);
        } else if (batch.stopped) {
          report.push(`${m.slug}: voice stopped (${batch.stopped})`);
          break;
        }
      }
      const { data: saved } = await admin
        .from("practice_sentences")
        .select("i, en, zh, audio_path, notes")
        .eq("practice_id", practice.id)
        .order("i");
      const problems = officialProblems({
        titleEn: m.title,
        titleZh: m.titleZh,
        subtitle: m.subtitle,
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
      report.push(
        `${m.slug}: ${problems.length ? `draft (${problems.join(", ")})` : "published"} ${practice.id}`,
      );
      console.log(report.at(-1));
    }
    console.log(
      `\n${report.join("\n")}\nspeech characters sent at most ${spent}`,
    );
  },
);
