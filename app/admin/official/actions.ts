"use server";

import { revalidatePath } from "next/cache";
import { logAudit } from "@/auth/audit";
import { getBatchCreator } from "@/auth/creator";
import { getAdminSupabase } from "@/auth/admin";
import type { MeteredFailure } from "@/lib/ai/metered";
import {
  annotateMissing,
  joinNotes,
  type StoredNotes,
} from "@/lib/custom-practice/notes";
import { isUuid } from "@/lib/custom-practice/organize";
import { isRichNotes, type RichNotes } from "@/lib/custom-practice/rich-notes";
import type { UsageBlock } from "@/lib/usage";

export type UpgradeNotesResult =
  | {
      ok: true;
      /** Sentences with current notes so far, of `total`. */
      done: number;
      total: number;
      /** Set once the practice moved to its new version. */
      version?: number;
      /** Already on the current notes: nothing was called. */
      upToDate?: boolean;
    }
  | {
      ok: false;
      reason: "unavailable" | "invalid" | "not-found" | MeteredFailure;
      limit?: UsageBlock;
    };

/**
 * One step of "regenerate notes" on /admin/official (D80): makes current
 * (version 2) notes for the next chunk of an official practice's
 * sentences, on the admin's batch allowance (D77), keeping each in the
 * shared cache. Once every sentence has them, the practice moves to its
 * next version (upgrade_practice_notes keeps the old notes as a
 * snapshot, D44). The page calls it until done === total. A practice
 * already on current notes costs nothing.
 */
export async function upgradeOfficialNotes(
  practiceId: unknown,
): Promise<UpgradeNotesResult> {
  if (!isUuid(practiceId)) return { ok: false, reason: "invalid" };
  const [creator, admin] = [await getBatchCreator(), getAdminSupabase()];
  if (!creator || !admin) return { ok: false, reason: "unavailable" };
  const { data: practice } = await admin
    .from("practices")
    .select("id, official, practice_sentences(i, en, notes)")
    .eq("id", practiceId)
    .is("removed_at", null)
    .maybeSingle();
  if (!practice?.official) return { ok: false, reason: "not-found" };
  const rows = [...practice.practice_sentences].sort((a, b) => a.i - b.i);
  const total = rows.length;
  if (rows.every((row) => isRichNotes(row.notes))) {
    return { ok: true, done: total, total, upToDate: true };
  }
  const result = await annotateMissing(
    creator,
    rows.map((row) => row.en),
    rows.map(() => null),
    1,
  );
  if (!result.ok) return result;
  const notes = result.value;
  const done = notes.filter((n) => n && isRichNotes(n)).length;
  if (done < total) return { ok: true, done, total };
  const joined = joinNotes(notes as StoredNotes[]);
  const { data: version, error } = await admin.rpc("upgrade_practice_notes", {
    target: practiceId,
    new_notes: notes as RichNotes[],
    new_vocab: joined.vocab,
    new_grammar: joined.grammar,
  });
  if (error) return { ok: false, reason: "failed" };
  await logAudit(
    creator.user.id,
    "practice.notes-upgrade",
    { type: "practice", id: practiceId },
    { to: version },
  );
  revalidatePath("/admin/official");
  revalidatePath("/", "layout");
  return { ok: true, done, total, version };
}
