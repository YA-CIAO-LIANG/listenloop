"use server";

import { getAdminSupabase } from "@/auth/admin";
import { logAudit } from "@/auth/audit";
import { getAdminUser } from "@/auth/creator";
import { textLength, unchangedSince } from "@/lib/content-fixes";
import { isUuid } from "@/lib/custom-practice/organize";
import { joinNotes, type StoredNotes } from "@/lib/custom-practice/notes";
import { isRichNotes } from "@/lib/custom-practice/rich-notes";
import type { Json } from "@/lib/supabase/database.types";

export type FixDecision = "accept" | "reject";

export type FixResult =
  | { ok: true }
  | {
      ok: false;
      /** stale: the sentence changed since the fix was suggested. */
      reason: "unavailable" | "invalid" | "not-found" | "stale" | "failed";
    };

/**
 * An admin accepts or rejects one suggested fix (D117). Accepting writes
 * the suggestion into the sentence, only if the sentence is still what
 * the fix was made from (otherwise the fix is marked stale), refreshes
 * the material's joined vocabulary and grammar when notes change, and
 * records it in the admin audit, like rejecting. Nothing is revalidated:
 * practice pages are rendered on each request, and the review page keeps
 * the decided fix on screen with what happened until the next visit.
 */
export async function resolveContentFix(
  fixId: unknown,
  decision: unknown,
): Promise<FixResult> {
  if (!isUuid(fixId) || (decision !== "accept" && decision !== "reject")) {
    return { ok: false, reason: "invalid" };
  }
  const [actor, admin] = [await getAdminUser(), getAdminSupabase()];
  if (!actor || !admin) return { ok: false, reason: "unavailable" };

  const { data: fix } = await admin
    .from("content_fixes")
    .select(
      "id, practice_id, sentence_index, field, kind, current, suggested, status",
    )
    .eq("id", fixId)
    .maybeSingle();
  if (!fix || fix.status !== "pending")
    return { ok: false, reason: "not-found" };
  const close = (status: "accepted" | "rejected" | "stale") =>
    admin
      .from("content_fixes")
      .update({
        status,
        resolved_at: new Date().toISOString(),
        resolved_by: actor.id,
      })
      .eq("id", fix.id)
      .eq("status", "pending");
  const target = { type: "practice" as const, id: fix.practice_id };
  const where = { sentence: fix.sentence_index + 1, kind: fix.kind };

  if (decision === "reject") {
    const { error } = await close("rejected");
    if (error) return { ok: false, reason: "failed" };
    await logAudit(actor.id, "contentFix.reject", target, where);
    return { ok: true };
  }

  const { data: sentences } = await admin
    .from("practice_sentences")
    .select("i, zh, notes")
    .eq("practice_id", fix.practice_id)
    .order("i", { ascending: true });
  const sentence = sentences?.find((s) => s.i === fix.sentence_index);
  if (!sentence) return { ok: false, reason: "not-found" };
  const stored = fix.field === "zh" ? sentence.zh : sentence.notes;
  if (!unchangedSince(stored, fix.current)) {
    await close("stale");
    return { ok: false, reason: "stale" };
  }

  const { error } = await admin
    .from("practice_sentences")
    .update(
      fix.field === "zh"
        ? { zh: String(fix.suggested) }
        : { notes: fix.suggested as Json },
    )
    .eq("practice_id", fix.practice_id)
    .eq("i", fix.sentence_index);
  if (error) return { ok: false, reason: "failed" };
  if (fix.field === "notes") {
    // The handout's vocabulary and grammar are joined from every sentence.
    const notes = (sentences ?? []).map((s) =>
      s.i === fix.sentence_index ? fix.suggested : s.notes,
    );
    if (notes.every(isRichNotes)) {
      const joined = joinNotes(notes as StoredNotes[]);
      await admin
        .from("practices")
        .update({
          vocab: joined.vocab as unknown as Json,
          grammar: joined.grammar as unknown as Json,
        })
        .eq("id", fix.practice_id);
    }
  }
  await close("accepted");
  await logAudit(
    actor.id,
    "contentFix.accept",
    target,
    fix.field === "zh"
      ? { ...where, from: fix.current, to: fix.suggested }
      : {
          ...where,
          from: `${textLength(fix.current)} chars`,
          to: `${textLength(fix.suggested)} chars`,
        },
  );
  return { ok: true };
}
