"use server";

import { revalidatePath } from "next/cache";
import { getAdminSupabase } from "@/auth/admin";
import type { WriteResult } from "@/auth/admin-writes";
import { logAudit } from "@/auth/audit";
import { getAdminUser } from "@/auth/creator";
import { parseMaterialMeta } from "@/lib/custom-practice/generation";
import { isUuid } from "@/lib/custom-practice/organize";
import {
  isOfficialState,
  moveInOrder,
  officialColumns,
  officialState,
} from "@/lib/material-admin";

/**
 * Managing materials from the admin dashboard (D58), with the secret key
 * and an audit entry for each change. Official practices must be made by
 * an admin (so no learner can later edit content shown to everyone), and
 * only a practice with its notes and audio done can be published.
 */
export type MaterialResult =
  WriteResult | { ok: false; reason: "not-admin-made" | "not-ready" };

type Admin = NonNullable<ReturnType<typeof getAdminSupabase>>;

async function asAdmin(
  run: (admin: Admin, actorId: string) => Promise<MaterialResult>,
): Promise<MaterialResult> {
  const [actor, admin] = [await getAdminUser(), getAdminSupabase()];
  if (!actor || !admin) return { ok: false, reason: "unavailable" };
  const result = await run(admin, actor.id).catch((): MaterialResult => ({
    ok: false,
    reason: "failed",
  }));
  if (result.ok) {
    revalidatePath("/admin/materials");
    revalidatePath("/", "layout");
  }
  return result;
}

/** Not official, an official draft, or published in the library. */
export async function setOfficialState(
  practiceId: unknown,
  state: unknown,
): Promise<MaterialResult> {
  if (!isUuid(practiceId) || !isOfficialState(state)) {
    return { ok: false, reason: "invalid" };
  }
  return asAdmin(async (admin, actorId) => {
    const { data: practice } = await admin
      .from("practices")
      .select(
        "user_id, official, published, notes_generated_at, removed_at, practice_sentences(audio_path)",
      )
      .eq("id", practiceId)
      .maybeSingle();
    if (!practice || practice.removed_at)
      return { ok: false, reason: "not-found" };
    if (state !== "none") {
      const { data: author } = await admin
        .from("profiles")
        .select("role")
        .eq("user_id", practice.user_id)
        .maybeSingle();
      if (author?.role !== "admin")
        return { ok: false, reason: "not-admin-made" };
    }
    if (state === "published") {
      const sentences = practice.practice_sentences;
      const ready =
        practice.notes_generated_at !== null &&
        sentences.length > 0 &&
        sentences.every((s) => s.audio_path);
      if (!ready) return { ok: false, reason: "not-ready" };
    }
    const { error } = await admin
      .from("practices")
      .update(officialColumns(state))
      .eq("id", practiceId);
    if (error) return { ok: false, reason: "failed" };
    await logAudit(
      actorId,
      "practice.official-state",
      { type: "practice", id: practiceId },
      { from: officialState(practice), to: state },
    );
    return { ok: true };
  });
}

/** Moves a published official practice one place up or down the library. */
export async function moveOfficial(
  practiceId: unknown,
  by: unknown,
): Promise<MaterialResult> {
  if (!isUuid(practiceId) || (by !== -1 && by !== 1)) {
    return { ok: false, reason: "invalid" };
  }
  return asAdmin(async (admin, actorId) => {
    const { data: rows, error } = await admin
      .from("practices")
      .select("id")
      .eq("official", true)
      .eq("published", true)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
    if (error || !rows) return { ok: false, reason: "failed" };
    const ids = rows.map((row) => row.id);
    if (!ids.includes(practiceId)) return { ok: false, reason: "not-found" };
    const order = moveInOrder(ids, practiceId, by);
    for (const [index, id] of order.entries()) {
      const { error: writeError } = await admin
        .from("practices")
        .update({ sort_order: index + 1 })
        .eq("id", id);
      if (writeError) return { ok: false, reason: "failed" };
    }
    await logAudit(
      actorId,
      "practice.order",
      { type: "practice", id: practiceId },
      { from: ids.indexOf(practiceId) + 1, to: order.indexOf(practiceId) + 1 },
    );
    return { ok: true };
  });
}

/** Sets where a practice belongs (D57), or clears it (null). */
export async function setMaterialCategory(
  practiceId: unknown,
  meta: unknown,
): Promise<MaterialResult> {
  const parsed = meta === null ? null : parseMaterialMeta(meta);
  if (!isUuid(practiceId) || (meta !== null && !parsed)) {
    return { ok: false, reason: "invalid" };
  }
  return asAdmin(async (admin, actorId) => {
    const { data, error } = await admin
      .from("practices")
      .update({
        category: parsed?.category ?? null,
        scenario: parsed?.scenario ?? null,
        level: parsed?.level ?? null,
        exam: parsed?.exam ?? null,
        exam_target: parsed?.examTarget ?? null,
      })
      .eq("id", practiceId)
      .select("id");
    if (error) return { ok: false, reason: "failed" };
    if (!data.length) return { ok: false, reason: "not-found" };
    await logAudit(
      actorId,
      "practice.category",
      { type: "practice", id: practiceId },
      { to: parsed ? `${parsed.category}/${parsed.scenario}` : null },
    );
    return { ok: true };
  });
}
