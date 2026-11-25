/**
 * Makes the official writing prompts' model-sentence audio ahead (D195),
 * for the daily back-translation: every sentence a learner can be asked
 * (lib/writing/back-translation.ts), in WritingLoop's voice, into the
 * shared speech cache. Azure Speech F0 (free); no language model.
 *
 *   npm run writing:audio                    # prints the plan
 *   WRITING_AUDIO_YES=1 npm run writing:audio  # makes them
 *
 * Sentences already in the cache are skipped, so a stopped run can be
 * started again. Stops before this month's F0 characters would pass
 * F0_STOP (a margin under the 500,000 free). Every call is in api_calls,
 * on the admin's batch allowance (User 000).
 */
import { createClient } from "@supabase/supabase-js";
import { expect, it } from "vitest";
import { supabaseAudioStore } from "@/auth/audio-store";
import { supabaseUsageMeter } from "@/auth/creator";
import { getUsageSettings } from "@/auth/usage-settings";
import { writingPrompts } from "@/data/writing";
import { getAiProviders } from "@/lib/ai/providers";
import { speechCacheKey, voiceSentences } from "@/lib/custom-practice/audio";
import type { Database } from "@/lib/supabase/database.types";
import { AZURE_SPEECH_FREE_CHARS } from "@/lib/usage-report";
import { WRITING_VOICE } from "@/lib/writing/audio";
import { BACK_MAX_WORDS, modelSentences } from "@/lib/writing/back-translation";
import { batchMeterOptions } from "./cost-guard";

/** Leave this much of the free tier for learners this month. */
const F0_STOP = AZURE_SPEECH_FREE_CHARS - 100_000;

const env = (name: string) => process.env[name] ?? "";

it(
  "makes the writing model sentences' audio",
  { timeout: 3_600_000 },
  async () => {
    expect(env("LISTENLOOP_UNATTENDED"), "no paid calls unattended").not.toBe(
      "1",
    );
    const providers = getAiProviders(process.env);
    const url = env("NEXT_PUBLIC_SUPABASE_URL");
    const key = env("SUPABASE_SERVICE_ROLE_KEY");
    expect(providers, "AI providers configured in .env.local").not.toBeNull();
    expect(
      url && key,
      "Supabase URL and secret key in .env.local",
    ).toBeTruthy();
    const admin = createClient<Database>(url, key, {
      auth: { persistSession: false },
    });
    const store = supabaseAudioStore(admin);

    const sentences = [
      ...new Set(
        writingPrompts
          .filter((p) => !p.draft)
          .flatMap((p) => modelSentences(p).map((s) => s.en))
          .filter((en) => en.split(/\s+/).length <= BACK_MAX_WORDS),
      ),
    ];
    const todo: string[] = [];
    for (const en of sentences) {
      const hash = await speechCacheKey(
        providers!.speech.id,
        WRITING_VOICE,
        en,
      );
      if (!(await store.find(hash))) todo.push(en);
    }
    const chars = todo.reduce((sum, en) => sum + en.length, 0);
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    // Summed in the database: a plain select returns at most 1,000 rows,
    // which undercounts a busy month (2026-11-25).
    const { data: totals } = await admin.rpc("api_usage_totals", {
      day_start: monthStart.toISOString(),
      month_start: monthStart.toISOString(),
    });
    const used = totals?.[0]?.month_azure_speech_chars ?? Infinity;
    console.log(
      `${sentences.length} sentences, ${todo.length} to make (${chars} characters); F0 this month: ${used} used, stop at ${F0_STOP}.`,
    );
    if (env("WRITING_AUDIO_YES") !== "1") {
      console.log("Dry run. Set WRITING_AUDIO_YES=1 to make them.");
      return;
    }
    expect(used + chars, "within the F0 margin").toBeLessThanOrEqual(F0_STOP);

    const { data: owner } = await admin
      .from("profiles")
      .select("user_id")
      .eq("number", 0)
      .maybeSingle();
    expect(owner, "the owner's profile (User 000)").toBeTruthy();
    const deps = {
      providers: providers!,
      meter: supabaseUsageMeter(
        admin,
        owner!.user_id,
        () => new Date(),
        batchMeterOptions(await getUsageSettings(admin)),
      ),
      store,
    };
    let made = 0;
    for (let i = 0; i < todo.length; i += 20) {
      const batch = await voiceSentences(
        deps,
        WRITING_VOICE,
        todo.slice(i, i + 20).map((en, j) => ({ i: i + j, en })),
      );
      made += batch.done.length;
      if (batch.stopped) {
        console.log(`stopped: ${batch.stopped} after ${made}`);
        break;
      }
    }
    console.log(`Made ${made} of ${todo.length}.`);
  },
);
