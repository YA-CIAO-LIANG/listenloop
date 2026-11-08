"use server";

import { revalidatePath } from "next/cache";
import { allowAction } from "@/auth/rate-limit";
import { getServerSupabase } from "@/auth/server";
import { getSignedInUser } from "@/auth/session";
import {
  ANNOUNCEMENT_MAX,
  CLASS_NAME_MAX,
  DISPLAY_NAME_MAX,
  isInviteCode,
  newInviteCode,
} from "@/lib/classroom";
import { isLocalDate } from "@/lib/dates";
import { isPassRules } from "@/lib/pass-rules";
import { parseCustomPracticeId } from "@/lib/practice-material";
import { practiceTitles } from "@/lib/titles";
import { getVideo } from "@/lib/video-library";

/**
 * Classroom (D103). Every write runs with the person's own session, so
 * row level security decides: teachers change only their classes,
 * students only their own membership. Joining goes through join_class,
 * which checks the code and the teacher's seats.
 */
export type ClassResult =
  | { ok: true; id?: string }
  | {
      ok: false;
      reason:
        | "unavailable"
        | "busy"
        | "invalid"
        | "notTeacher"
        | "code"
        | "material"
        | "failed";
    };

const text = (value: unknown, max: number) =>
  typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, max)
    : "";

async function context() {
  const [user, supabase] = await Promise.all([
    getSignedInUser(),
    getServerSupabase(),
  ]);
  return user && supabase ? { user, supabase } : null;
}

/** A teacher (class plan, or an admin trying it) makes a class. */
export async function createClass(name: unknown): Promise<ClassResult> {
  const ctx = await context();
  if (!ctx) return { ok: false, reason: "unavailable" };
  if (ctx.user.classroomSeats === null && ctx.user.role !== "admin") {
    return { ok: false, reason: "notTeacher" };
  }
  const title = text(name, CLASS_NAME_MAX);
  if (!title) return { ok: false, reason: "invalid" };
  if (!(await allowAction("classroom", ctx.user.id))) {
    return { ok: false, reason: "busy" };
  }
  // A code is random; another try on the rare clash.
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await ctx.supabase
      .from("classes")
      .insert({
        teacher_id: ctx.user.id,
        name: title,
        invite_code: newInviteCode(),
      })
      .select("id")
      .single();
    if (data) {
      revalidatePath("/classroom");
      return { ok: true, id: data.id };
    }
    if (error && error.code !== "23505") break;
  }
  return { ok: false, reason: "failed" };
}

/** A student joins with the code, under the name the teacher will see. */
export async function joinClass(input: {
  code: unknown;
  name: unknown;
  consent: unknown;
}): Promise<ClassResult> {
  const ctx = await context();
  if (!ctx) return { ok: false, reason: "unavailable" };
  const name = text(input.name, DISPLAY_NAME_MAX);
  if (!isInviteCode(input.code) || !name)
    return { ok: false, reason: "invalid" };
  if (!(await allowAction("classroom", ctx.user.id))) {
    return { ok: false, reason: "busy" };
  }
  const { data, error } = await ctx.supabase.rpc("join_class", {
    code: String(input.code).toUpperCase(),
    name,
    consent: input.consent === true,
  });
  if (error || !data) return { ok: false, reason: "code" };
  revalidatePath("/classroom");
  return { ok: true, id: data };
}

export async function removeStudent(
  classId: unknown,
  userId: unknown,
): Promise<ClassResult> {
  const ctx = await context();
  if (!ctx || typeof classId !== "string" || typeof userId !== "string") {
    return { ok: false, reason: "invalid" };
  }
  const { error } = await ctx.supabase
    .from("class_members")
    .delete()
    .eq("class_id", classId)
    .eq("user_id", userId);
  if (error) return { ok: false, reason: "failed" };
  revalidatePath(`/classroom/${classId}`);
  return { ok: true };
}

export async function leaveClass(classId: unknown): Promise<ClassResult> {
  const ctx = await context();
  if (!ctx || typeof classId !== "string")
    return { ok: false, reason: "invalid" };
  const { error } = await ctx.supabase
    .from("class_members")
    .delete()
    .eq("class_id", classId)
    .eq("user_id", ctx.user.id);
  if (error) return { ok: false, reason: "failed" };
  revalidatePath("/classroom");
  return { ok: true };
}

/**
 * A material a teacher may assign: a built-in video, a published
 * official practice, or one of their own (the title is kept with it).
 */
async function assignableTitle(
  supabase: NonNullable<Awaited<ReturnType<typeof getServerSupabase>>>,
  userId: string,
  videoId: string,
): Promise<string | null> {
  const video = getVideo(videoId);
  if (video) return video.title;
  const uuid = parseCustomPracticeId(videoId);
  if (!uuid) return null;
  const { data } = await supabase
    .from("practices")
    .select("title, title_en, title_zh, user_id, official, published")
    .eq("id", uuid)
    .is("removed_at", null)
    .maybeSingle();
  if (!data) return null;
  const allowed = data.user_id === userId || (data.official && data.published);
  if (!allowed) return null;
  const titles = practiceTitles(data);
  return [titles.en, titles.zh].filter(Boolean).join("｜") || data.title;
}

export async function createAssignment(input: {
  classId: unknown;
  videoId: unknown;
  startsOn: unknown;
  dueOn: unknown;
  rules?: unknown;
}): Promise<ClassResult> {
  const ctx = await context();
  if (!ctx) return { ok: false, reason: "unavailable" };
  const { classId, videoId, startsOn, dueOn, rules } = input;
  if (
    typeof classId !== "string" ||
    typeof videoId !== "string" ||
    !isLocalDate(startsOn) ||
    !isLocalDate(dueOn) ||
    dueOn < startsOn ||
    (rules !== undefined && rules !== null && !isPassRules(rules))
  ) {
    return { ok: false, reason: "invalid" };
  }
  const title = await assignableTitle(ctx.supabase, ctx.user.id, videoId);
  if (!title) return { ok: false, reason: "material" };
  const { error } = await ctx.supabase.from("assignments").insert({
    class_id: classId,
    video_id: videoId,
    title: title.slice(0, 200),
    starts_on: startsOn,
    due_on: dueOn,
    rules: rules ?? null,
  });
  if (error) return { ok: false, reason: "failed" };
  revalidatePath(`/classroom/${classId}`);
  return { ok: true };
}

export async function deleteAssignment(
  classId: unknown,
  id: unknown,
): Promise<ClassResult> {
  const ctx = await context();
  if (!ctx || typeof classId !== "string" || typeof id !== "string") {
    return { ok: false, reason: "invalid" };
  }
  const { error } = await ctx.supabase
    .from("assignments")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, reason: "failed" };
  revalidatePath(`/classroom/${classId}`);
  return { ok: true };
}

export async function postAnnouncement(
  classId: unknown,
  body: unknown,
): Promise<ClassResult> {
  const ctx = await context();
  const message = typeof body === "string" ? body.trim() : "";
  if (
    !ctx ||
    typeof classId !== "string" ||
    !message ||
    [...message].length > ANNOUNCEMENT_MAX
  ) {
    return { ok: false, reason: "invalid" };
  }
  if (!(await allowAction("classroom", ctx.user.id))) {
    return { ok: false, reason: "busy" };
  }
  const { error } = await ctx.supabase
    .from("announcements")
    .insert({ class_id: classId, body: message });
  if (error) return { ok: false, reason: "failed" };
  revalidatePath(`/classroom/${classId}`);
  return { ok: true };
}

export async function deleteAnnouncement(
  classId: unknown,
  id: unknown,
): Promise<ClassResult> {
  const ctx = await context();
  if (!ctx || typeof classId !== "string" || typeof id !== "string") {
    return { ok: false, reason: "invalid" };
  }
  const { error } = await ctx.supabase
    .from("announcements")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, reason: "failed" };
  revalidatePath(`/classroom/${classId}`);
  return { ok: true };
}
