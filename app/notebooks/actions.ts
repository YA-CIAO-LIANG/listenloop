"use server";

import {
  writeAsAdmin,
  writeOutcome,
  type WriteResult,
} from "@/auth/admin-writes";
import {
  cleanName,
  cleanNote,
  isUuid,
  NOTEBOOK_LIMITS,
} from "@/lib/custom-practice/organize";

/**
 * Notebooks: the learner's own words and sentences with notes (D19, D25).
 * Admin-only for now, like the rest of roadmap d.
 */
const asAdmin = (write: Parameters<typeof writeAsAdmin>[1]) =>
  writeAsAdmin("/notebooks", write);

export async function createNotebook(title: unknown): Promise<WriteResult> {
  const name = cleanName(title, NOTEBOOK_LIMITS.title);
  if (!name) return { ok: false, reason: "invalid" };
  return asAdmin(async (supabase, userId) =>
    writeOutcome(
      await supabase
        .from("notebooks")
        .insert({ user_id: userId, title: name })
        .select("id"),
    ),
  );
}

export async function renameNotebook(
  id: unknown,
  title: unknown,
): Promise<WriteResult> {
  const name = cleanName(title, NOTEBOOK_LIMITS.title);
  if (!isUuid(id) || !name) return { ok: false, reason: "invalid" };
  return asAdmin(async (supabase) =>
    writeOutcome(
      await supabase
        .from("notebooks")
        .update({ title: name })
        .eq("id", id)
        .select("id"),
    ),
  );
}

/** Deletes the notebook and everything in it. */
export async function deleteNotebook(id: unknown): Promise<WriteResult> {
  if (!isUuid(id)) return { ok: false, reason: "invalid" };
  return asAdmin(async (supabase) =>
    writeOutcome(
      await supabase.from("notebooks").delete().eq("id", id).select("id"),
    ),
  );
}

export async function addEntry(
  notebookId: unknown,
  text: unknown,
  note: unknown,
): Promise<WriteResult> {
  const entry = cleanName(text, NOTEBOOK_LIMITS.text);
  const cleanedNote = cleanNote(note, NOTEBOOK_LIMITS.note);
  if (!isUuid(notebookId) || !entry || cleanedNote === null) {
    return { ok: false, reason: "invalid" };
  }
  return asAdmin(async (supabase, userId) =>
    writeOutcome(
      await supabase
        .from("notebook_entries")
        .insert({
          notebook_id: notebookId,
          user_id: userId,
          text: entry,
          note: cleanedNote,
        })
        .select("id"),
    ),
  );
}

export async function deleteEntry(id: unknown): Promise<WriteResult> {
  if (!isUuid(id)) return { ok: false, reason: "invalid" };
  return asAdmin(async (supabase) =>
    writeOutcome(
      await supabase
        .from("notebook_entries")
        .delete()
        .eq("id", id)
        .select("id"),
    ),
  );
}
