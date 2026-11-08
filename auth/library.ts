import {
  parseSavedFilter,
  practiceLibraryItem,
  videoLibraryItem,
  type LibraryItem,
} from "@/lib/library";
import { audioSeconds, LIBRARY_DEFAULT_DOCUMENT } from "@/lib/library-config";
import {
  customPracticeId,
  parseCustomPracticeId,
} from "@/lib/practice-material";
import { getAllVideos } from "@/lib/video-library";
import { listOfficialPractices } from "./public-practices";
import { getServerSupabase } from "./server";
import { getSignedInUser } from "./session";

/** How many people practice each material, by its id in links. */
export async function learnerCounts(): Promise<Map<string, number>> {
  const supabase = await getServerSupabase();
  if (!supabase) return new Map();
  const { data, error } = await supabase.rpc("material_learner_counts");
  if (error) return new Map();
  return new Map(data.map((row) => [row.video_id, row.learners]));
}

/** Seconds of audio per practice ("p-<uuid>" ids); unknown ones are left out. */
export async function practiceSeconds(
  ids: readonly string[],
): Promise<Map<string, number>> {
  const uuids = ids.flatMap((id) => parseCustomPracticeId(id) ?? []);
  const supabase = await getServerSupabase();
  if (!supabase || uuids.length === 0) return new Map();
  const { data, error } = await supabase.rpc("practice_audio_bytes", {
    ids: uuids,
  });
  if (error) return new Map();
  const seconds = new Map<string, number>();
  for (const row of data) {
    const id = customPracticeId(row.practice_id);
    seconds.set(
      id,
      (seconds.get(id) ?? 0) + audioSeconds(row.bytes, row.mime_type),
    );
  }
  return seconds;
}

/**
 * The whole library (D70): published built-in videos and official
 * practices, with how long each runs and how many people practice it.
 */
export async function getLibraryItems(): Promise<LibraryItem[]> {
  const [official, learners] = await Promise.all([
    listOfficialPractices(),
    learnerCounts(),
  ]);
  const seconds = await practiceSeconds(official.map((p) => p.id));
  return [
    ...official.map((practice) =>
      practiceLibraryItem(practice, {
        seconds: seconds.get(practice.id),
        learners: learners.get(practice.id),
      }),
    ),
    ...getAllVideos().map((video) =>
      videoLibraryItem(video, learners.get(video.id)),
    ),
  ];
}

/**
 * The signed-in learner's saved default filter (D98), as its query
 * string; undefined when signed out (the browser keeps theirs), null
 * when they haven't saved one.
 */
export async function getSavedLibraryDefault(): Promise<
  string | null | undefined
> {
  const user = await getSignedInUser();
  const supabase = user ? await getServerSupabase() : null;
  if (!user || !supabase) return undefined;
  const { data } = await supabase
    .from("user_documents")
    .select("data")
    .eq("user_id", user.id)
    .eq("key", LIBRARY_DEFAULT_DOCUMENT)
    .maybeSingle();
  const filter = (data?.data as { filter?: unknown } | null)?.filter;
  return parseSavedFilter(filter) ? (filter as string) : null;
}
