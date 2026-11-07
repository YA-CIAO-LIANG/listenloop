/**
 * Upgrades practices' notes to version 2 (D67, D69) with the real
 * provider: the 14 official sample drafts (D59, listed below by id);
 * learners' practices aren't upgraded automatically. Audio isn't made
 * again. Each practice moves to its next version, with the old notes kept
 * as a snapshot, so a week in progress keeps the notes it started with.
 *
 *   npm run notes:upgrade                 # prints the plan and estimate
 *   UPGRADE_YES=1 npm run notes:upgrade   # upgrades (Joe's go-ahead)
 *
 * Also records one real answer as the annotate fixture
 * (tests/fixtures/ai/azure-openai/annotate.json), replacing the hand-made
 * one, so tests replay what Azure really sends.
 *
 * Cost guard: every call reserves its worst case first, and the run stops
 * before it could pass BUDGET_USD. Practices already on version 2 are
 * skipped, so a stopped run can be started again. Every call is logged.
 */
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, it } from "vitest";
import { supabaseAiCache } from "@/auth/ai-cache";
import { supabaseUsageMeter } from "@/auth/creator";
import { azureOpenAiLanguage } from "@/lib/ai/azure-openai";
import { annotateBudget, maxCost } from "@/lib/ai/budgets";
import { meteredLanguage } from "@/lib/ai/metered";
import { getAiProviders } from "@/lib/ai/providers";
import { toMicros } from "@/lib/ai/pricing";
import {
  annotateMissing,
  joinNotes,
  NOTES_CHUNK,
  type StoredNotes,
} from "@/lib/custom-practice/notes";
import { isRichNotes, type RichNotes } from "@/lib/custom-practice/rich-notes";
import type { Database } from "@/lib/supabase/database.types";
import { OFFICIAL_DAILY_LIMITS } from "@/lib/usage";
import { emptyTally, guardedMeter, usd } from "./cost-guard";

/**
 * What's left of Joe's US$0.50 for this upgrade (2026-11-08): the first
 * run spent US$0.0286 (the fixture and 7 calls) before a cut-off answer
 * stopped it.
 */
const BUDGET_USD = 0.47;

const FIXTURE_SENTENCE =
  "If you're going to the library later, could you pick up the book I reserved for my history class?";

/**
 * The 14 official sample drafts made on 2026-11-07 (D59), by id: one of
 * them was unmarked official since, and still belongs to the set.
 */
const DRAFT_IDS = [
  "94439aa3-7ec3-48ed-89ad-9a70ce985226",
  "ff87bb4a-6294-4c89-8de1-9602df9e08cb",
  "0ef050f7-30bd-4e49-9789-ddfdd02fb6c8",
  "e2ede85c-c7a2-4614-af18-0e58c9edc4ea",
  "2aa761f9-4342-4088-b55a-cd185cd879a9",
  "1685838a-1298-43bc-a45e-177b9744d1f2",
  "7a790f83-d241-4de0-9923-f54e99c493e6",
  "6f395363-ce2a-46d3-9ac3-8d211dd2eee2",
  "d8f90c9f-c6f0-4265-977d-e910ddbff79b",
  "7c6db1a2-e298-4405-ac0e-b81b00060f0e",
  "84ff0c51-5734-4300-b09c-d728295562c9",
  "6402cf6e-6f59-46fd-a6d5-984572ac2923",
  "c0002540-bce3-471c-a672-a70ee49749ff",
  "2afeab5b-6fc7-4579-9cb2-004018cf740c",
];

const env = (name: string) => process.env[name]?.trim() ?? "";

it(
  "upgrades the official practices' notes",
  { timeout: 3_600_000 },
  async () => {
    // Never in an unattended run (scripts/auto-continue/run.sh, D65).
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

    const { data: practices, error } = await admin
      .from("practices")
      .select("id, title, user_id, version, practice_sentences(i, en, notes)")
      .in("id", DRAFT_IDS)
      .order("created_at");
    if (error) throw new Error(error.message);
    const todo = (practices ?? []).filter((p) =>
      p.practice_sentences.some((s) => !isRichNotes(s.notes)),
    );

    // The plan and its estimate, before anything is called.
    const price = providers!.language.price;
    let worst = 0;
    let sentences = 0;
    for (const p of todo) {
      const ens = p.practice_sentences.map((s) => s.en);
      sentences += ens.length;
      for (let k = 0; k < ens.length; k += NOTES_CHUNK) {
        worst += toMicros(
          maxCost(annotateBudget(ens.slice(k, k + NOTES_CHUNK)), price),
        );
      }
      console.log(
        `plan: ${p.title} (${ens.length} sentences, version ${p.version} → ${p.version + 1})`,
      );
    }
    console.log(
      `${todo.length} practices, ${sentences} sentences; expected about US$${(sentences * 0.0008).toFixed(2)} (D67), worst case ${usd(worst)}; budget ${usd(toMicros(BUDGET_USD))}`,
    );
    if (env("UPGRADE_YES") !== "1") {
      console.log("Dry run. Set UPGRADE_YES=1 to upgrade.");
      return;
    }

    const total = emptyTally();
    const report: string[] = [];
    const ownerId = todo[0]?.user_id;

    // 1. One real answer as the fixture tests replay.
    if (ownerId) {
      const tally = { current: emptyTally(), total };
      const meter = guardedMeter(
        supabaseUsageMeter(
          admin,
          ownerId,
          () => new Date(),
          OFFICIAL_DAILY_LIMITS,
        ),
        tally,
        BUDGET_USD,
      );
      let recorded: { request: unknown; response: unknown } | null = null;
      const recording: typeof fetch = async (input, init) => {
        const response = await fetch(input, init);
        recorded = {
          request: JSON.parse(init?.body as string),
          response: await response.clone().json(),
        };
        return response;
      };
      const language = azureOpenAiLanguage(
        {
          endpoint: env("AZURE_OPENAI_ENDPOINT"),
          apiKey: env("AZURE_OPENAI_API_KEY"),
          deployment: env("AZURE_OPENAI_DEPLOYMENT").toLowerCase(),
          model: env("AZURE_OPENAI_MODEL").toLowerCase(),
        },
        recording,
      );
      const result = await meteredLanguage(
        { providers: { ...providers!, language }, meter },
        annotateBudget([FIXTURE_SENTENCE]),
        () => language.annotate([FIXTURE_SENTENCE]),
      );
      if (result.ok && recorded) {
        writeFileSync(
          "tests/fixtures/ai/azure-openai/annotate.json",
          JSON.stringify(recorded, null, 2) + "\n",
        );
        console.log(`fixture recorded · ${usd(tally.current.micros)}`);
      } else {
        console.log(
          `fixture not recorded (${result.ok ? "no exchange" : result.reason})`,
        );
      }
    }

    // 2. Each practice: notes for every sentence, then one upgrade.
    for (const practice of todo) {
      const rows = [...practice.practice_sentences].sort((a, b) => a.i - b.i);
      const tally = { current: emptyTally(), total };
      const deps = {
        providers: providers!,
        meter: guardedMeter(
          supabaseUsageMeter(
            admin,
            practice.user_id,
            () => new Date(),
            OFFICIAL_DAILY_LIMITS,
          ),
          tally,
          BUDGET_USD,
        ),
        cache: supabaseAiCache(admin),
      };
      const result = await annotateMissing(
        deps,
        rows.map((r) => r.en),
        rows.map(() => null),
        Infinity,
      );
      if (!result.ok || result.value.some((n) => !n || !isRichNotes(n))) {
        console.log(
          `stop at "${practice.title}": ${result.ok ? "notes missing" : result.reason}`,
        );
        break;
      }
      const notes = result.value as RichNotes[];
      const joined = joinNotes(notes as StoredNotes[]);
      const { data: version, error: upgradeError } = await admin.rpc(
        "upgrade_practice_notes",
        {
          target: practice.id,
          new_notes: notes,
          new_vocab: joined.vocab,
          new_grammar: joined.grammar,
        },
      );
      if (upgradeError) throw new Error(upgradeError.message);
      const counts = { easy: 0, medium: 0, hard: 0 };
      for (const n of notes) counts[n.difficulty] += 1;
      const c = tally.current;
      const line = `${practice.id}\t${practice.title}\tv${version}\t${rows.length} sentences (easy ${counts.easy} / medium ${counts.medium} / hard ${counts.hard})\tin ${c.inputTokens} / out ${c.outputTokens} tokens\t${usd(c.micros)}`;
      console.log(`  ✓ ${line}`);
      report.push(line);
    }
    console.log("\nREPORT");
    for (const line of report) console.log(line);
    console.log(
      `TOTAL\tin ${total.inputTokens} / out ${total.outputTokens} tokens\t${usd(total.micros)}\t${total.calls} calls`,
    );
  },
);
