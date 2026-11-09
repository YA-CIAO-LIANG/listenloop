/**
 * The quality audit of published official materials (D115): rules on
 * every material (titles, translations, audio, sentence and notes length),
 * then a sample of translations checked by the language model within a
 * budget. It only reports (nothing is changed), to the console and to
 * AUDIT_OUT if set.
 *
 *   npm run official:audit                  # rules, plus the AI plan and estimate
 *   AUDIT_YES=1 npm run official:audit      # also the AI sample
 *
 * Budget: AUDIT_BUDGET_USD (default 0.30), on the admin's batch allowance
 * and the site's monthly cap (D77); every call is in api_calls.
 */
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, it } from "vitest";
import { supabaseUsageMeter } from "@/auth/creator";
import { getUsageSettings } from "@/auth/usage-settings";
import { auditBudget, maxCost } from "@/lib/ai/budgets";
import { meteredLanguage } from "@/lib/ai/metered";
import { toMicros } from "@/lib/ai/pricing";
import { getAiProviders } from "@/lib/ai/providers";
import {
  auditSample,
  parseAudit,
  ruleIssues,
  type AuditIssue,
  type AuditMaterial,
} from "@/lib/official-audit";
import type { Database } from "@/lib/supabase/database.types";
import { practiceTitles } from "@/lib/titles";
import { batchMeterOptions, emptyTally, guardedMeter, usd } from "./cost-guard";

const env = (name: string) => process.env[name]?.trim() ?? "";
/** Sentences checked by AI per material, and pairs per call. */
const PER_MATERIAL = Number(env("AUDIT_PER_MATERIAL")) || 3;
const PER_CALL = 30;

it("audits the official materials", { timeout: 3_600_000 }, async () => {
  expect(env("LISTENLOOP_UNATTENDED"), "no paid calls unattended").not.toBe(
    "1",
  );
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  expect(url && key, "Supabase URL and secret key").toBeTruthy();
  const admin = createClient<Database>(url, key, {
    auth: { persistSession: false },
  });
  const budget = Number(env("AUDIT_BUDGET_USD")) || 0.3;

  const { data: rows, error } = await admin
    .from("practices")
    .select(
      "id, title, title_en, title_zh, subtitle, category, practice_sentences(i, en, zh, audio_path, notes)",
    )
    .eq("official", true)
    .eq("published", true)
    .is("removed_at", null)
    .is("youtube_id", null)
    .order("sort_order", { ascending: true, nullsFirst: false });
  expect(error).toBeNull();
  const materials: (AuditMaterial & {
    title: string;
    category: string | null;
  })[] = (rows ?? []).map((row) => {
    const titles = practiceTitles(row);
    return {
      id: row.id,
      title: titles.en || row.title,
      category: row.category,
      titleEn: row.title_en,
      titleZh: row.title_zh,
      subtitle: row.subtitle,
      sentences: [...row.practice_sentences]
        .sort((a, b) => a.i - b.i)
        .map((s) => ({
          en: s.en,
          zh: s.zh,
          audioPath: s.audio_path,
          notes: s.notes,
        })),
    };
  });

  const lines: string[] = [];
  const out = (line = "") => {
    console.log(line);
    lines.push(line);
  };
  const sentenceCount = materials.reduce((n, m) => n + m.sentences.length, 0);
  out(`# 官方教材品質稽核（${new Date().toISOString().slice(0, 10)}）`);
  out();
  out(`已發布的官方教材 ${materials.length} 份、${sentenceCount} 句。`);
  out();
  out("## 規則檢查");
  out();
  const counts = new Map<AuditIssue["kind"], number>();
  for (const material of materials) {
    const issues = ruleIssues(material);
    if (issues.length === 0) continue;
    out(
      `- **${material.title}**（${material.category ?? "—"}，\`${material.id}\`）`,
    );
    for (const issue of issues) {
      counts.set(issue.kind, (counts.get(issue.kind) ?? 0) + 1);
      const where =
        "sentence" in issue ? `第 ${issue.sentence + 1} 句` : "標題";
      const detail =
        "detail" in issue && issue.detail ? `（${issue.detail}）` : "";
      out(`  - ${issue.kind}：${where}${detail}`);
    }
  }
  out();
  out(
    `合計：${[...counts].map(([kind, n]) => `${kind} ${n}`).join("、") || "沒有問題"}`,
  );

  // The AI sample.
  const sample = materials.flatMap((m) =>
    auditSample(m, PER_MATERIAL).map((i) => ({
      material: m,
      i,
      en: m.sentences[i].en,
      zh: m.sentences[i].zh ?? "",
    })),
  );
  const providers = getAiProviders(process.env);
  out();
  out("## AI 抽查翻譯");
  out();
  const batches: (typeof sample)[] = [];
  for (let k = 0; k < sample.length; k += PER_CALL) {
    batches.push(sample.slice(k, k + PER_CALL));
  }
  const worst = providers
    ? batches.reduce(
        (n, batch) =>
          n +
          toMicros(
            maxCost(
              auditBudget({ pairs: batch.map(({ en, zh }) => ({ en, zh })) }),
              providers.language.price,
            ),
          ) +
          // The instructions, counted as input tokens.
          2_000,
        0,
      )
    : 0;
  console.log(
    `plan: ${sample.length} sentences in ${batches.length} calls; worst case about ${usd(worst)}; budget ${usd(toMicros(budget))}`,
  );
  if (env("AUDIT_YES") !== "1" || !providers) {
    out("（沒有執行：預設只做規則檢查，加 AUDIT_YES=1 才抽查。）");
  } else {
    const { data: owner } = await admin
      .from("profiles")
      .select("user_id")
      .eq("number", 0)
      .maybeSingle();
    expect(owner, "the owner's profile (User 000)").toBeTruthy();
    const settings = await getUsageSettings(admin);
    const total = emptyTally();
    const deps = {
      providers,
      meter: guardedMeter(
        supabaseUsageMeter(
          admin,
          owner!.user_id,
          () => new Date(),
          batchMeterOptions(settings),
        ),
        { current: emptyTally(), total },
        budget,
      ),
    };
    let checked = 0;
    const flagged: string[] = [];
    for (const batch of batches) {
      const input = { pairs: batch.map(({ en, zh }) => ({ en, zh })) };
      const result = await meteredLanguage(deps, auditBudget(input), () =>
        providers.language.auditTranslations(input),
      );
      if (!result.ok) {
        console.log(`  stop: ${result.reason}`);
        break;
      }
      const verdicts = parseAudit(result.value, batch.length);
      if (verdicts.size < batch.length) {
        console.log(
          `  ${batch.length - verdicts.size} of ${batch.length} verdicts missing`,
        );
      }
      checked += verdicts.size;
      verdicts.forEach((v, k) => {
        if (v.ok) return;
        const { material, i, en, zh } = batch[k];
        flagged.push(
          `- **${material.title}** 第 ${i + 1} 句：${en}\n  - 現在：${zh}\n  - 問題：${v.issue}`,
        );
      });
    }
    out(
      `抽查 ${checked} 句（每份 ${PER_MATERIAL} 句），${flagged.length} 句可能有問題：`,
    );
    out();
    for (const line of flagged) out(line);
    out();
    out(
      `花費：${total.calls} 次呼叫，輸入 ${total.inputTokens}、輸出 ${total.outputTokens} token，${usd(total.micros)}`,
    );
  }
  if (env("AUDIT_OUT"))
    writeFileSync(env("AUDIT_OUT"), `${lines.join("\n")}\n`);
});
