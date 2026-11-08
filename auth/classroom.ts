import { cache } from "react";
import type { MaterialInfo } from "@/lib/analytics";
import type { Assignment, ClassMember } from "@/lib/classroom";
import { parseCustomPracticeId } from "@/lib/practice-material";
import { getVideo } from "@/lib/video-library";
import { getServerSupabase } from "./server";
import { getSignedInUser } from "./session";

/**
 * Classroom data (D103), read with the person's own session: row level
 * security keeps teachers to their classes and students to theirs.
 */
export type ClassSummary = {
  id: string;
  name: string;
  inviteCode: string | null;
  teacher: boolean;
  students: number;
};

export const myClasses = cache(async (): Promise<ClassSummary[]> => {
  const [user, supabase] = await Promise.all([
    getSignedInUser(),
    getServerSupabase(),
  ]);
  if (!user || !supabase) return [];
  const { data } = await supabase
    .from("classes")
    .select(
      "id, name, invite_code, teacher_id, created_at, class_members(count)",
    )
    .is("archived_at", null)
    .order("created_at");
  return (data ?? []).map((row) => {
    const teacher = row.teacher_id === user.id;
    const members = row.class_members as unknown as { count: number }[];
    return {
      id: row.id,
      name: row.name,
      inviteCode: teacher ? row.invite_code : null,
      teacher,
      students: members?.[0]?.count ?? 0,
    };
  });
});

export type ClassDetail = {
  id: string;
  name: string;
  inviteCode: string | null;
  teacher: boolean;
  members: ClassMember[];
  assignments: (Assignment & { rules: unknown })[];
  announcements: { id: string; body: string; createdAt: string }[];
};

export const classDetail = cache(
  async (id: string): Promise<ClassDetail | null> => {
    const [user, supabase] = await Promise.all([
      getSignedInUser(),
      getServerSupabase(),
    ]);
    if (!user || !supabase) return null;
    const { data: row } = await supabase
      .from("classes")
      .select("id, name, invite_code, teacher_id")
      .eq("id", id)
      .maybeSingle();
    if (!row) return null;
    const teacher = row.teacher_id === user.id;
    const [members, assignments, announcements] = await Promise.all([
      teacher
        ? supabase
            .from("class_members")
            .select("user_id, display_name, joined_at")
            .eq("class_id", id)
            .order("display_name")
        : Promise.resolve({ data: [] }),
      supabase
        .from("assignments")
        .select("id, video_id, title, starts_on, due_on, rules")
        .eq("class_id", id)
        .order("due_on"),
      supabase
        .from("announcements")
        .select("id, body, created_at")
        .eq("class_id", id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    return {
      id: row.id,
      name: row.name,
      inviteCode: teacher ? row.invite_code : null,
      teacher,
      members: (members.data ?? []).map((m) => ({
        userId: m.user_id,
        displayName: m.display_name,
      })),
      assignments: (assignments.data ?? []).map((a) => ({
        id: a.id,
        videoId: a.video_id,
        title: a.title,
        startsOn: a.starts_on,
        dueOn: a.due_on,
        rules: a.rules,
      })),
      announcements: (announcements.data ?? []).map((a) => ({
        id: a.id,
        body: a.body,
        createdAt: a.created_at,
      })),
    };
  },
);

/** The class's progress on its assignments (class_progress, teacher only). */
export async function classProgressRows(id: string) {
  const supabase = await getServerSupabase();
  if (!supabase) return [];
  const { data } = await supabase.rpc("class_progress", { target: id });
  return data ?? [];
}

/** English sentences of each assigned material, for misheard words. */
export async function assignedMaterials(
  videoIds: readonly string[],
): Promise<Map<string, MaterialInfo>> {
  const materials = new Map<string, MaterialInfo>();
  const uuids: string[] = [];
  for (const id of videoIds) {
    const video = getVideo(id);
    if (video) {
      materials.set(id, {
        title: video.title,
        category: null,
        level: video.level,
        sentences: video.sentences.map((s) => s.en),
      });
    } else {
      const uuid = parseCustomPracticeId(id);
      if (uuid) uuids.push(uuid);
    }
  }
  const supabase = await getServerSupabase();
  if (supabase && uuids.length > 0) {
    const { data } = await supabase
      .from("practices")
      .select("id, title, level, practice_sentences(i, en)")
      .in("id", uuids);
    for (const row of data ?? []) {
      materials.set(`p-${row.id}`, {
        title: row.title,
        category: null,
        level: row.level,
        sentences: [...row.practice_sentences]
          .sort((a, b) => a.i - b.i)
          .map((s) => s.en),
      });
    }
  }
  return materials;
}

/** What a teacher can assign: their own practices and published official ones. */
export async function assignableMaterials(): Promise<
  { id: string; title: string }[]
> {
  const [user, supabase] = await Promise.all([
    getSignedInUser(),
    getServerSupabase(),
  ]);
  if (!user || !supabase) return [];
  const { data } = await supabase
    .from("practices")
    .select("id, title, title_en, title_zh, user_id, official, published")
    .or(`user_id.eq.${user.id},and(official.eq.true,published.eq.true)`)
    .is("removed_at", null)
    .not("notes_generated_at", "is", null)
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? []).map((row) => ({
    id: `p-${row.id}`,
    title: [row.title_en, row.title_zh].filter(Boolean).join("｜") || row.title,
  }));
}
