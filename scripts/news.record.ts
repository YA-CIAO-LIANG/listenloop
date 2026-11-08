/**
 * Makes news materials (D100), with the real providers: the newest
 * releases from NEWS_SOURCES (lib/news/sources.ts) that haven't been used,
 * each rewritten in ListenLoop's own words from its facts (never its
 * text), then split, translated, annotated, voiced, checked, and
 * published like any official material (scripts/official-pipeline.ts),
 * with "rewritten from" and a link to the release.
 *
 *   npm run news:make                 # prints the plan and estimate
 *   NEWS_YES=1 npm run news:make      # makes them
 *
 * The weekly schedule (.github/workflows/news.yml, off until Joe turns it
 * on) runs the second form. Cost guard: the run's budget
 * (NEWS_RUN_BUDGET_USD) on top of the batch allowance and the site's
 * monthly cap (D77); when either is used up, the run stops (paused until
 * the next one). Speech is Azure F0 (free). Every call is in api_calls.
 */
import { createClient } from "@supabase/supabase-js";
import { expect, it } from "vitest";
import { supabaseAiCache } from "@/auth/ai-cache";
import { supabaseAudioStore } from "@/auth/audio-store";
import { supabaseUsageMeter } from "@/auth/creator";
import { getUsageSettings } from "@/auth/usage-settings";
import { maxCost, newsBudget } from "@/lib/ai/budgets";
import { meteredLanguage } from "@/lib/ai/metered";
import { toMicros } from "@/lib/ai/pricing";
import { getAiProviders } from "@/lib/ai/providers";
import type { NewsInput, VoiceAccent } from "@/lib/ai/types";
import { LEVEL_PROMPTS, type Level } from "@/lib/categories";
import {
  checkGeneratedText,
  WORDS_PER_MINUTE,
} from "@/lib/custom-practice/generation";
import {
  articleFacts,
  parseRss,
  pickNews,
  similarHeadlines,
  type NewsItem,
} from "@/lib/news/feed";
import {
  NEWS_PER_RUN,
  NEWS_RUN_BUDGET_USD,
  NEWS_SOURCES,
  type NewsSource,
} from "@/lib/news/sources";
import type { Database } from "@/lib/supabase/database.types";
import { batchMeterOptions, emptyTally, guardedMeter, usd } from "./cost-guard";
import { buildOfficial } from "./official-pipeline";

const env = (name: string) => process.env[name]?.trim() ?? "";
const USER_AGENT = "ListenLoop news (https://listenloop-three.vercel.app)";
/** About a minute and a half of news. */
const WORDS = Math.round(WORDS_PER_MINUTE * 1.5);
/** Summaries shorter than this get the release page's first paragraphs. */
const SHORT_SUMMARY = 300;

async function get(url: string): Promise<string | null> {
  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT },
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  return response?.ok ? response.text() : null;
}

it("makes news materials", { timeout: 3_600_000 }, async () => {
  expect(env("LISTENLOOP_UNATTENDED"), "no paid calls unattended").not.toBe(
    "1",
  );
  const providers = getAiProviders(process.env);
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  expect(providers, "AI providers configured").not.toBeNull();
  expect(url && key, "Supabase URL and secret key").toBeTruthy();
  const admin = createClient<Database>(url, key, {
    auth: { persistSession: false },
  });
  const count = Number(env("NEWS_COUNT")) || NEWS_PER_RUN;
  const budget = Number(env("NEWS_BUDGET_USD")) || NEWS_RUN_BUDGET_USD;
  const { data: owner } = await admin
    .from("profiles")
    .select("user_id")
    .eq("number", 0)
    .maybeSingle();
  expect(owner, "the owner's profile (User 000)").toBeTruthy();

  // Releases already made into a material are never used twice.
  const { data: usedRows } = await admin
    .from("practices")
    .select("source_url")
    .not("source_url", "is", null);
  const used = new Set((usedRows ?? []).map((r) => r.source_url as string));

  // The newest unused release of each source, in turn, until `count`.
  const now = new Date();
  const queues: { source: NewsSource; items: NewsItem[] }[] = [];
  for (const source of NEWS_SOURCES) {
    const xml = await get(source.feed);
    const items = xml ? pickNews(parseRss(xml), { used, now }) : [];
    console.log(`${source.name}: ${items.length} usable releases`);
    queues.push({ source, items });
  }
  const picked: { source: NewsSource; item: NewsItem }[] = [];
  while (picked.length < count && queues.some((q) => q.items.length > 0)) {
    for (const queue of queues) {
      // The next one not about a topic already picked.
      let item = queue.items.shift();
      while (
        item &&
        picked.some((p) => similarHeadlines(p.item.title, item!.title))
      ) {
        item = queue.items.shift();
      }
      if (item && picked.length < count) {
        picked.push({ source: queue.source, item });
      }
    }
  }

  const levels: Level[] = ["intermediate", "beginner", "advanced"];
  const accents: VoiceAccent[] = ["us", "gb", "au", "in"];
  let worst = 0;
  for (const { source, item } of picked) {
    const input = {
      headline: item.title,
      summary: "x".repeat(1500),
      source: source.name,
      level: "",
      words: WORDS,
    };
    worst +=
      toMicros(maxCost(newsBudget(input), providers!.language.price)) * 4;
    console.log(`plan: ${source.name} · ${item.title} · ${item.link}`);
  }
  console.log(
    `worst case about ${usd(worst)}; run budget ${usd(toMicros(budget))}; speech on Azure F0 (free)`,
  );
  if (env("NEWS_YES") !== "1") {
    console.log("Dry run. Set NEWS_YES=1 to make them.");
    return;
  }

  const total = emptyTally();
  const settings = await getUsageSettings(admin);
  const report: string[] = [];
  for (const [n, { source, item }] of picked.entries()) {
    const level = levels[n % levels.length];
    const accent = accents[n % accents.length];
    const tally = { current: emptyTally(), total };
    const deps = {
      providers: providers!,
      meter: guardedMeter(
        supabaseUsageMeter(
          admin,
          owner!.user_id,
          () => new Date(),
          batchMeterOptions(settings),
        ),
        tally,
        budget,
      ),
      cache: supabaseAiCache(admin),
      store: supabaseAudioStore(admin),
    };
    console.log(`\n▶ ${source.name}: ${item.title}`);
    let facts = item.summary;
    if (facts.length < SHORT_SUMMARY) {
      const page = await get(item.link);
      const more = page ? articleFacts(page) : "";
      if (more) facts = more;
    }
    const input: NewsInput = {
      headline: item.title,
      summary: facts,
      source: source.name,
      level: LEVEL_PROMPTS[level],
      words: WORDS,
    };
    const written = await meteredLanguage(deps, newsBudget(input), () =>
      deps.providers.language.rewriteNews(input),
    );
    if (!written.ok) {
      console.log(
        `  stop: rewrite ${written.reason} (budget or allowance used up)`,
      );
      break;
    }
    const text = checkGeneratedText(written.value, WORDS);
    if (!text || !text.titleZh || !text.subtitle) {
      console.log("  the story wasn't usable; skipped");
      continue;
    }
    const built = await buildOfficial(admin, deps, owner!.user_id, {
      title: text.title,
      titleZh: text.titleZh,
      subtitle: text.subtitle,
      text: text.text,
      format: "monologue",
      accent,
      meta: {
        category: "news",
        scenario: source.scenario,
        level,
        exam: null,
        examTarget: null,
      },
      source: { name: source.name, title: item.title, url: item.link },
    });
    if (!built.ok) {
      console.log(`  stop: ${built.stage} ${built.reason}`);
      break;
    }
    const c = tally.current;
    const state = built.published
      ? "published"
      : `draft (${built.problems.join(", ")})`;
    const line = `${built.id}\t${state}\t${text.title}｜${text.titleZh}\tnews/${source.scenario}\t${level}\t${accent}\t${built.sentences} sentences\tfrom ${source.name}: ${item.link}\tin ${c.inputTokens} / out ${c.outputTokens} tokens\t${c.chars} chars\t${usd(c.micros)}`;
    console.log(`  ✓ ${line}`);
    report.push(line);
  }
  console.log("\nREPORT");
  for (const line of report) console.log(line);
  console.log(
    `TOTAL\tin ${total.inputTokens} / out ${total.outputTokens} tokens\t${total.chars} chars\t${usd(total.micros)}\t${total.calls} calls`,
  );
});
