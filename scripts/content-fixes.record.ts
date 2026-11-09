/**
 * Suggested fixes for the published official materials (D117), for an
 * admin to accept or reject on /admin/fixes. No AI and no changes to any
 * material: full-width digits and letters by rule, notes over the audit's
 * limit shortened by rule, and the hand-written fixes in
 * scripts/content-fixes/*.json (from the quality audit's review).
 *
 *   npm run content:fixes                  # prints what it would store
 *   FIXES_YES=1 npm run content:fixes      # stores them
 *
 * A sentence and field with a pending fix already isn't suggested again.
 */
import { readdirSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, it } from "vitest";
import { fixesFor, type FixDraft, type HandFix } from "@/lib/content-fixes";
import { LONG_NOTES_CHARS } from "@/lib/official-audit";
import type { Database, Json } from "@/lib/supabase/database.types";

const env = (name: string) => process.env[name]?.trim() ?? "";
const DIR = "scripts/content-fixes";

it("suggests fixes for the official materials", async () => {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  expect(url && key, "Supabase URL and secret key").toBeTruthy();
  const admin = createClient<Database>(url, key, {
    auth: { persistSession: false },
  });
  const files = readdirSync(DIR).filter((f) => f.endsWith(".json"));
  const hand = files.flatMap((file) => {
    const fixes = JSON.parse(
      readFileSync(`${DIR}/${file}`, "utf8"),
    ) as HandFix[];
    return fixes.map((fix) => ({
      ...fix,
      source: file.replace(/\.json$/, ""),
    }));
  });

  const { data: rows, error } = await admin
    .from("practices")
    .select("id, title, practice_sentences(i, en, zh, notes)")
    .eq("official", true)
    .eq("published", true)
    .is("removed_at", null);
  expect(error).toBeNull();
  const drafts: (FixDraft & { title: string })[] = (rows ?? []).flatMap((row) =>
    fixesFor(
      row.id,
      [...row.practice_sentences].sort((a, b) => a.i - b.i),
      hand,
      LONG_NOTES_CHARS,
    ).map((draft) => ({ ...draft, title: row.title })),
  );
  const missing = hand.filter(
    (h) => !(rows ?? []).some((row) => row.id === h.practiceId),
  );
  for (const h of missing) {
    console.log(`  not found (unpublished?): ${h.practiceId} #${h.sentence}`);
  }

  const { data: pending } = await admin
    .from("content_fixes")
    .select("practice_id, sentence_index, field")
    .eq("status", "pending");
  const open = new Set(
    (pending ?? []).map(
      (p) => `${p.practice_id}#${p.sentence_index}#${p.field}`,
    ),
  );
  const fresh = drafts.filter(
    (d) => !open.has(`${d.practiceId}#${d.sentenceIndex}#${d.field}`),
  );
  const counts = new Map<string, number>();
  for (const d of fresh) {
    counts.set(d.kind, (counts.get(d.kind) ?? 0) + 1);
    const what =
      d.field === "zh"
        ? `${String(d.current)} → ${String(d.suggested)}`
        : `notes ${String(d.detail.before)} → ${String(d.detail.after)} chars`;
    console.log(`${d.kind}  ${d.title} #${d.sentenceIndex + 1}  ${what}`);
  }
  console.log(
    `${fresh.length} new fixes (${[...counts].map(([k, n]) => `${k} ${n}`).join(", ") || "none"}); ${drafts.length - fresh.length} already pending`,
  );
  if (env("FIXES_YES") !== "1" || fresh.length === 0) {
    console.log("not stored: run with FIXES_YES=1 to store them");
    return;
  }
  const source = (d: FixDraft) =>
    hand.find(
      (h) => h.practiceId === d.practiceId && h.sentence === d.sentenceIndex,
    )?.source ?? "rules";
  const { error: insertError } = await admin.from("content_fixes").insert(
    fresh.map((d) => ({
      practice_id: d.practiceId,
      sentence_index: d.sentenceIndex,
      field: d.field,
      kind: d.kind,
      current: d.current as Json,
      suggested: d.suggested as Json,
      reason: d.reason,
      detail: d.detail as Json,
      source:
        d.kind === "long-notes" || d.kind === "full-width"
          ? "rules"
          : source(d),
    })),
  );
  expect(insertError).toBeNull();
  console.log(`stored ${fresh.length} fixes`);
});
