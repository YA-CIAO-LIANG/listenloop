"use server";

import { revalidatePath } from "next/cache";
import { getAdminSupabase } from "@/auth/admin";
import { logAudit } from "@/auth/audit";
import {
  writeAsAdmin,
  writeOutcome,
  type WriteResult,
} from "@/auth/admin-writes";
import {
  cleanName,
  COLLECTION_TITLE_MAX,
  isUuid,
  isVisibility,
} from "@/lib/custom-practice/organize";
import { getAdminUser } from "@/auth/creator";
import { logEvent } from "@/auth/events";
import { customPracticeId } from "@/lib/practice-material";

/**
 * Organizing created practices (roadmap d5): collections, public or
 * private, and deleting. Admin-only like creating (D24).
 */
export type OrganizeResult = WriteResult;

const asAdmin = (write: Parameters<typeof writeAsAdmin>[1]) =>
  writeAsAdmin("/materials", write);
const outcome = writeOutcome;

export async function createCollection(
  title: unknown,
): Promise<OrganizeResult> {
  const name = cleanName(title, COLLECTION_TITLE_MAX);
  if (!name) return { ok: false, reason: "invalid" };
  return asAdmin(async (supabase, userId) =>
    outcome(
      await supabase
        .from("collections")
        .insert({ user_id: userId, title: name })
        .select("id"),
    ),
  );
}

export async function renameCollection(
  id: unknown,
  title: unknown,
): Promise<OrganizeResult> {
  const name = cleanName(title, COLLECTION_TITLE_MAX);
  if (!isUuid(id) || !name) return { ok: false, reason: "invalid" };
  return asAdmin(async (supabase) =>
    outcome(
      await supabase
        .from("collections")
        .update({ title: name })
        .eq("id", id)
        .select("id"),
    ),
  );
}

/** Its practices stay, just ungrouped (on delete set null). */
export async function deleteCollection(id: unknown): Promise<OrganizeResult> {
  if (!isUuid(id)) return { ok: false, reason: "invalid" };
  return asAdmin(async (supabase) =>
    outcome(
      await supabase.from("collections").delete().eq("id", id).select("id"),
    ),
  );
}

export async function setVisibility(
  kind: unknown,
  id: unknown,
  visibility: unknown,
): Promise<OrganizeResult> {
  if (
    (kind !== "practice" && kind !== "collection") ||
    !isUuid(id) ||
    !isVisibility(visibility)
  ) {
    return { ok: false, reason: "invalid" };
  }
  return asAdmin(async (supabase, userId) => {
    const result = outcome(
      await supabase
        .from(kind === "practice" ? "practices" : "collections")
        .update({ visibility })
        .eq("id", id)
        .select("id"),
    );
    if (result.ok && kind === "practice" && visibility === "public") {
      await logEvent(userId, {
        type: "practice_public",
        videoId: customPracticeId(id),
      });
    }
    return result;
  });
}

/** Moves a practice into one of the user's collections, or out (null). */
export async function movePractice(
  practiceId: unknown,
  collectionId: unknown,
): Promise<OrganizeResult> {
  if (!isUuid(practiceId) || (collectionId !== null && !isUuid(collectionId))) {
    return { ok: false, reason: "invalid" };
  }
  return asAdmin(async (supabase) =>
    outcome(
      await supabase
        .from("practices")
        .update({ collection_id: collectionId })
        .eq("id", practiceId)
        .select("id"),
    ),
  );
}

/**
 * Deletes a practice and its sentences. Audio files stay in the shared
 * cache (other practices may use them); progress on this device stays
 * until removed from My practices, like a video taken out of the library.
 */
export async function deletePractice(id: unknown): Promise<OrganizeResult> {
  if (!isUuid(id)) return { ok: false, reason: "invalid" };
  return asAdmin(async (supabase, userId) => {
    const result = outcome(
      await supabase.from("practices").delete().eq("id", id).select("id"),
    );
    if (result.ok) {
      await logEvent(userId, {
        type: "practice_delete",
        videoId: customPracticeId(id),
      });
    }
    return result;
  });
}

export type CopyOfficialResult =
  | { ok: true; id: string }
  | { ok: false; reason: "unavailable" | "invalid" | "not-found" | "failed" };

/**
 * Copies one of the admin's own practices to the official materials
 * (D80): the copy is an official draft, published from /admin/official;
 * the practice itself stays in My materials, unchanged. Written with
 * the secret key (copy_practice_as_official), so users can't.
 */
export async function copyAsOfficial(id: unknown): Promise<CopyOfficialResult> {
  if (!isUuid(id)) return { ok: false, reason: "invalid" };
  const user = await getAdminUser();
  const admin = user && getAdminSupabase();
  if (!user || !admin) return { ok: false, reason: "unavailable" };
  const { data: own } = await admin
    .from("practices")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .is("removed_at", null)
    .maybeSingle();
  if (!own) return { ok: false, reason: "not-found" };
  const { data: copy, error } = await admin.rpc("copy_practice_as_official", {
    source: id,
    actor: user.id,
  });
  if (error || !copy) return { ok: false, reason: "failed" };
  await logAudit(
    user.id,
    "practice.copy-official",
    { type: "practice", id: copy },
    { from: id },
  );
  revalidatePath("/admin/official");
  return { ok: true, id: copy };
}
